type WorkerRequest =
  | { type: 'DERIVE_ADDRESSES'; payload: { network: any; privateKey?: string } }
  | { type: 'GET_BALANCES'; payload: { network: any; privateKey: string } }
  | { type: 'GENERATE_DUST'; payload: { network: any; privateKey: string; dustAddress: string } }
  | { type: 'SEND_TRANSACTION'; payload: { network: any; privateKey: string; to: string; amount: string } };

let worker: Worker | null = null;
let requests = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./sdkWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const msg = e.data;
      if (msg?.id && requests.has(msg.id)) {
        const { resolve, reject } = requests.get(msg.id)!;
        requests.delete(msg.id);
        if (msg.type === 'RESPONSE') {
          resolve(msg.payload);
        } else if (msg.type === 'ERROR') {
          reject(new Error(msg.payload));
        }
      }
    };
    worker.onerror = (e) => {
      console.error('[Luna] Web Worker Error:', e);
      // Reject all pending requests
      const errorMsg = e.message || 'Worker failed to initialize or crashed';
      requests.forEach(({ reject }) => reject(new Error(errorMsg)));
      requests.clear();
    };
  }
  return worker;
}

export function executeInWorker<T>(type: WorkerRequest['type'], payload: WorkerRequest['payload']): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36).substring(7);
    requests.set(id, { resolve, reject });
    getWorker().postMessage({ id, type, payload });
  });
}
