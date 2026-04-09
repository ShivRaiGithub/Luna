import { deriveAddresses } from '../utils/addressDerivation';
import {
  getWalletBalancesWithSdk,
  registerDustWithSdk,
  submitNightTransactionWithSdk,
} from '../utils/sdkWallet';

self.onmessage = (e: MessageEvent) => {
  const message = e.data;
  if (!message || message.id === null) return;

  void (async () => {
    try {
      let payload: unknown;
      switch (message.type) {
        case 'DERIVE_ADDRESSES':
          payload = await deriveAddresses(message.payload.network, message.payload.privateKey);
          break;
        case 'GET_BALANCES':
          payload = await getWalletBalancesWithSdk(message.payload.network, message.payload.privateKey);
          break;
        case 'GENERATE_DUST':
          payload = await registerDustWithSdk(
            message.payload.network,
            message.payload.privateKey,
            message.payload.dustAddress,
          );
          break;
        case 'SEND_TRANSACTION':
          payload = await submitNightTransactionWithSdk(message.payload.network, message.payload.privateKey, {
            to: message.payload.to,
            amount: message.payload.amount,
          });
          break;
        default:
          throw new Error('Unknown worker request type');
      }
      self.postMessage({ id: message.id, type: 'RESPONSE', payload });
    } catch (error: any) {
      self.postMessage({
        id: message.id,
        type: 'ERROR',
        payload: error?.message || 'Worker request failed',
      });
    }
  })();
};

// Signal that the worker is fully loaded and ready
self.postMessage({ id: null, type: 'READY', payload: null });
