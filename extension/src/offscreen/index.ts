const PORT_NAME = 'luna-offscreen';
const RECONNECT_DELAY_MS = 500;

let port: chrome.runtime.Port | null = null;
let workerReady = false;

// Instantiate the worker to offload WASM compilation/execution from the main thread
const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

worker.onmessage = (e: MessageEvent) => {
  const msg = e.data;
  
  // Track Worker readiness
  if (msg?.id === null && msg?.type === 'READY') {
    workerReady = true;
  }

  // Forward to SW port (if connected)
  if (port) {
    port.postMessage(msg);
  }
};

worker.onerror = (e: ErrorEvent) => {
  console.error('[Luna] Offscreen worker error:', e.message);
};

function attachPort(nextPort: chrome.runtime.Port): void {
  port = nextPort;

  // Relay SW port messages -> Worker
  nextPort.onMessage.addListener((message: any) => {
    worker.postMessage(message);
  });

  nextPort.onDisconnect.addListener(() => {
    if (port === nextPort) {
      port = null;
    }
    setTimeout(connectToBackground, RECONNECT_DELAY_MS);
  });

  // If worker is already ready, signal SW immediately
  if (workerReady) {
    nextPort.postMessage({ id: null, type: 'READY', payload: null });
  }
}

function connectToBackground(): void {
  const nextPort = chrome.runtime.connect({ name: PORT_NAME });
  attachPort(nextPort);
}

connectToBackground();
