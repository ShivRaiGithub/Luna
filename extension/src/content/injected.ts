// Luna Wallet — Injected Provider
// Exposes window.luna to dApps (similar to window.ethereum for MetaMask)

(function () {
  'use strict';

  if ((window as any).luna) return; // Already injected

  let messageId = 0;
  const pendingCallbacks = new Map<number, { resolve: Function; reject: Function }>();

  // Internal messaging bridge
  function sendToBackground(type: string, payload?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = ++messageId;
      pendingCallbacks.set(id, { resolve, reject });

      window.postMessage({ lunaMessage: true, id, type, payload }, '*');

      // Timeout after 60s
      setTimeout(() => {
        if (pendingCallbacks.has(id)) {
          pendingCallbacks.delete(id);
          reject(new Error('Luna: Request timed out'));
        }
      }, 60000);
    });
  }

  // Handle responses from background
  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data?.lunaResponse) return;
    const { id, response } = event.data;
    const cb = pendingCallbacks.get(id);
    if (!cb) return;
    pendingCallbacks.delete(id);

    if (response?.error) {
      cb.reject(new Error(response.error));
    } else {
      cb.resolve(response);
    }
  });

  // ── Event emitter ────────────────────────────────────────────────────────────
  const eventListeners = new Map<string, Function[]>();

  function emit(event: string, data?: any) {
    const listeners = eventListeners.get(event) || [];
    listeners.forEach(fn => fn(data));
  }

  // ── Luna Provider API ─────────────────────────────────────────────────────────
  const luna = {
    isLuna: true,
    isMidnight: true,
    version: '1.0.0',
    networkId: 'undeployed',

    /**
     * Connect to Luna wallet.
     * Returns the user's wallet address.
     */
    async connect(): Promise<{ address: string; networkId: string }> {
      const response = await sendToBackground('LUNA_CONNECT_REQUEST', {
        origin: window.location.origin,
        name: document.title || window.location.hostname,
      });

      if (!response.success) {
        throw new Error(response.error || 'Connection rejected');
      }

      luna.networkId = response.network || luna.networkId;
      emit('connect', { address: response.address, networkId: luna.networkId });
      return { address: response.address, networkId: luna.networkId };
    },

    /**
     * Get the current wallet address (if already connected).
     */
    async getAddress(): Promise<string | null> {
      const response = await sendToBackground('LUNA_GET_ADDRESS');
      return response.address;
    },

    /**
     * Get the current network.
     */
    async getNetwork(): Promise<string> {
      const response = await sendToBackground('LUNA_GET_NETWORK');
      luna.networkId = response.network || luna.networkId;
      return luna.networkId;
    },

    /**
     * Request a transaction to be signed and broadcast.
     */
    async signAndSubmit(tx: {
      to: string;
      amount: string;
      memo?: string;
    }): Promise<{ txHash: string }> {
      if (!tx.to || !tx.amount) {
        throw new Error('Luna: Missing transaction fields (to, amount)');
      }

      const response = await sendToBackground('LUNA_SIGN_TX', {
        to: tx.to,
        amount: tx.amount,
        memo: tx.memo,
      });

      if (!response.success) {
        throw new Error(response.error || 'Transaction rejected');
      }

      return { txHash: response.txHash };
    },

    async submitTransaction(tx: {
      to: string;
      amount: string;
      memo?: string;
    }): Promise<{ txHash: string }> {
      return luna.signAndSubmit(tx);
    },

    async getConnectionStatus(): Promise<{ connected: boolean; networkId: string }> {
      const response = await sendToBackground('LUNA_GET_CONNECTION_STATUS', {
        origin: window.location.origin,
      });
      return { connected: !!response.connected, networkId: luna.networkId };
    },

    async getBalances(): Promise<any> {
      const response = await sendToBackground('LUNA_GET_BALANCES');
      if (!response.success) {
        throw new Error(response.error || 'Failed to get balances');
      }
      return response.balances || {};
    },

    async signData(data: string): Promise<{ signature: string }> {
      if (!data) throw new Error('Luna: Missing data payload');
      const response = await sendToBackground('LUNA_SIGN_DATA', { data });
      if (!response.success) {
        throw new Error(response.error || 'Signing rejected');
      }
      return { signature: response.signature };
    },

    /**
     * Check if wallet is already connected to this dApp.
     */
    async isConnected(): Promise<boolean> {
      try {
        const addr = await luna.getAddress();
        return !!addr;
      } catch {
        return false;
      }
    },

    // Event listeners
    on(event: string, listener: Function) {
      if (!eventListeners.has(event)) eventListeners.set(event, []);
      eventListeners.get(event)!.push(listener);
    },

    off(event: string, listener: Function) {
      const listeners = eventListeners.get(event) || [];
      eventListeners.set(event, listeners.filter(fn => fn !== listener));
    },

    once(event: string, listener: Function) {
      const wrapper = (data: any) => {
        listener(data);
        luna.off(event, wrapper);
      };
      luna.on(event, wrapper);
    },
  };

  // ── Expose on window ──────────────────────────────────────────────────────────
  Object.defineProperty(window, 'luna', {
    value: luna,
    writable: false,
    configurable: false,
  });

  // Also expose as midnight provider
  Object.defineProperty(window, 'midnight', {
    value: { luna, isLuna: true },
    writable: false,
    configurable: false,
  });

  // Announce provider
  window.dispatchEvent(new Event('luna#initialized'));
  window.dispatchEvent(new CustomEvent('midnight#initialized', { detail: { provider: 'luna' } }));

  console.log('[Luna] Provider injected — window.luna ready 🌑');
})();
