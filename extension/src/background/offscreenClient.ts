export const PORT_NAME = 'luna-offscreen';

type PendingEntry = {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

let port: chrome.runtime.Port | null = null;
let ready = false;
let readyPromise: Promise<void> | null = null;
let readyResolve: (() => void) | null = null;
const pending = new Map<string, PendingEntry>();

export function acceptOffscreenPort(nextPort: chrome.runtime.Port): void {
  port = nextPort;
  ready = false;

  nextPort.onMessage.addListener((message: any) => {
    if (message?.id === null) {
      if (message?.type === 'READY') {
        ready = true;
        readyResolve?.();
        readyResolve = null;
      }
      return;
    }

    const entry = pending.get(message?.id);
    if (!entry) {
      return;
    }

    clearTimeout(entry.timer);
    pending.delete(message.id);

    if (message?.type === 'ERROR') {
      entry.reject(new Error(String(message?.payload || 'Offscreen request failed')));
      return;
    }

    entry.resolve(message?.payload);
  });

  nextPort.onDisconnect.addListener(() => {
    port = null;
    ready = false;

    for (const entry of pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(new Error('Offscreen document disconnected'));
    }

    pending.clear();
    readyPromise = null;
    readyResolve = null;
  });
}

export function hasOffscreenPort(): boolean {
  return port !== null;
}

export function waitForOffscreenReady(): Promise<void> {
  if (ready) {
    return Promise.resolve();
  }

  if (!readyPromise) {
    readyPromise = new Promise((resolve, reject) => {
      readyResolve = resolve;
      setTimeout(() => {
        if (!ready) {
          readyResolve = null;
          readyPromise = null;
          reject(new Error('Offscreen document did not become ready in time'));
        }
      }, 30_000);
    });
  }

  return readyPromise;
}

export function requestOffscreen<T>(type: string, payload: unknown): Promise<T> {
  if (!port) {
    throw new Error('Offscreen document is not connected');
  }

  const id = crypto.randomUUID();

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`${type} timed out in offscreen document`));
    }, 120_000);

    pending.set(id, { resolve, reject, timer });
    port!.postMessage({ id, type, payload });
  });
}
