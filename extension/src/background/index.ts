// Luna Wallet — Background Service Worker
// Handles: dApp communication, transaction queuing, wallet state

import { getBalance, submitTransaction, type BalanceResponse } from '../utils/midnight';
import {
  PORT_NAME,
  acceptOffscreenPort,
  hasOffscreenPort,
  requestOffscreen,
  waitForOffscreenReady,
} from './offscreenClient';

interface PendingConnection {
  id: string;
  origin: string;
  name: string;
  tabId: number;
  timestamp: number;
}

interface PendingTransaction {
  id: string;
  sessionId?: string;
  to: string;
  amount: string;
  memo?: string;
  tabId: number;
  timestamp: number;
}

const pendingConnections = new Map<string, PendingConnection>();
const pendingTransactions = new Map<string, PendingTransaction>();
const approvedOrigins = new Set<string>();
let creatingOffscreenPromise: Promise<void> | null = null;

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === PORT_NAME) {
    acceptOffscreenPort(port);
  }
});

// ── Message Handler ────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, payload } = message;

  switch (type) {
    case 'LUNA_CONNECT_REQUEST':
      handleConnectRequest(payload, sender, sendResponse);
      return true; // async

    case 'LUNA_SIGN_TX':
      handleSignTx(payload, sender, sendResponse);
      return true;

    case 'LUNA_GET_ADDRESS':
      handleGetAddress(sendResponse);
      return true;

    case 'LUNA_GET_NETWORK':
      handleGetNetwork(sendResponse);
      return true;

    case 'LUNA_GET_CONNECTION_STATUS':
      handleGetConnectionStatus(payload, sendResponse);
      return true;

    case 'LUNA_DERIVE_ADDRESSES':
      handleDeriveAddresses(payload, sendResponse);
      return true;

    case 'LUNA_SIGN_DATA':
      handleSignData(payload, sendResponse);
      return true;

    case 'LUNA_GET_BALANCES':
      handleGetBalances(sendResponse);
      return true;

    case 'LUNA_GENERATE_DUST':
      handleGenerateDust(payload, sendResponse);
      return true;

    case 'LUNA_SEND_TRANSACTION':
      handleSendTransaction(payload, sendResponse);
      return true;

    case 'LUNA_APPROVE_CONNECTION':
      handleApproveConnection(payload, sendResponse);
      return true;

    case 'LUNA_REJECT_CONNECTION':
      handleRejectConnection(payload, sendResponse);
      return true;

    case 'LUNA_APPROVE_TX':
      handleApproveTx(payload, sendResponse);
      return true;

    case 'LUNA_REJECT_TX':
      handleRejectTx(payload, sendResponse);
      return true;

    default:
      sendResponse({ error: 'Unknown message type' });
  }
});

// ── Handlers ──────────────────────────────────────────────────────────────────

async function handleConnectRequest(
  payload: { origin: string; name: string },
  sender: chrome.runtime.MessageSender,
  sendResponse: (r: any) => void
) {
  const { origin, name } = payload;
  const tabId = sender.tab?.id;
  if (!tabId) return sendResponse({ error: 'No tab' });

  // Already approved
  if (approvedOrigins.has(origin)) {
    const [address, network] = await Promise.all([getStoredAddress(), getStoredNetwork()]);
    return sendResponse({ success: true, address, network });
  }

  const id = `conn_${Date.now()}`;
  pendingConnections.set(id, { id, origin, name, tabId, timestamp: Date.now() });

  // Open popup with connection request
  await chrome.action.openPopup();

  // Notify popup
  chrome.runtime.sendMessage({
    type: 'LUNA_PENDING_CONNECTION',
    payload: { id, origin, name },
  }).catch(() => {});

  // Wait for response (poll)
  const result = await waitForResponse(id, pendingConnections, 60000);
  sendResponse(result);
}

async function handleSignTx(
  payload: { sessionId?: string; to: string; amount: string; memo?: string },
  sender: chrome.runtime.MessageSender,
  sendResponse: (r: any) => void
) {
  const tabId = sender.tab?.id;
  if (!tabId) return sendResponse({ error: 'No tab' });

  const id = `tx_${Date.now()}`;
  pendingTransactions.set(id, { id, ...payload, tabId, timestamp: Date.now() });

  await chrome.action.openPopup();

  chrome.runtime.sendMessage({
    type: 'LUNA_PENDING_TX',
    payload: { id, ...payload },
  }).catch(() => {});

  const result = await waitForResponse(id, pendingTransactions, 60000);
  sendResponse(result);
}

async function handleGetAddress(sendResponse: (r: any) => void) {
  const address = await getStoredAddress();
  sendResponse({ success: true, address });
}

async function handleGetNetwork(sendResponse: (r: any) => void) {
  const result = await chrome.storage.local.get('luna_network');
  sendResponse({ success: true, network: result.luna_network || 'undeployed' });
}

function handleGetConnectionStatus(payload: { origin?: string }, sendResponse: (r: any) => void) {
  const origin = payload?.origin;
  const connected = !!origin && approvedOrigins.has(origin);
  sendResponse({ success: true, connected });
}

function handleDeriveAddresses(
  payload: { network?: 'mainnet' | 'preprod' | 'preview' | 'undeployed' | 'localnet'; privateKey?: string },
  sendResponse: (r: any) => void
) {
  void (async () => {
    try {
      const network = payload?.network || await getStoredNetwork();
      await ensureOffscreenReady();
      const addresses = await requestOffscreen<{ shielded: string; unshielded: string; dust: string }>(
        'DERIVE_ADDRESSES',
        { network, privateKey: payload?.privateKey },
      );
      sendResponse({ success: true, addresses });
    } catch (err: any) {
      sendResponse({ success: false, error: err?.message || 'Failed to derive addresses' });
    }
  })();
}

function handleSignData(payload: { data: string }, sendResponse: (r: any) => void) {
  void (async () => {
    try {
      const privateKey = await getSessionPrivateKey();
      if (!privateKey) {
        sendResponse({ success: false, error: 'Wallet is locked. Unlock to sign data.' });
        return;
      }

      const signature = await signDataWithSessionKey(payload?.data || '', privateKey);
      sendResponse({ success: true, signature });
    } catch (err: any) {
      sendResponse({ success: false, error: err?.message || 'Failed to sign data' });
    }
  })();
}

function handleGetBalances(sendResponse: (r: any) => void) {
  void (async () => {
    try {
      const [addresses, network, privateKey] = await Promise.all([
        getStoredAddresses(),
        getStoredNetwork(),
        getSessionPrivateKey(),
      ]);

      const currentAddresses = await getStoredAddresses();
      
      let sdkBalances: any = null;
      let rpcBalances: any = null;

      if (privateKey) {
        await ensureOffscreenReady();
        try {
          sdkBalances = await requestOffscreen<{
            addresses: { shielded: string; unshielded: string; dust: string };
            night: { shielded: string; unshielded: string; total: string };
            dust: string;
          }>('GET_BALANCES', { network, privateKey });

          if (sdkBalances.addresses?.shielded) {
            await chrome.storage.local.set({
              luna_address: sdkBalances.addresses.shielded,
              luna_addresses: sdkBalances.addresses,
            });
          }
        } catch (sdkError: any) {
          console.warn('[Luna] SDK GET_BALANCES failed, falling back to RPC/Indexer:', sdkError);
        }
      }

      if (currentAddresses?.shielded || sdkBalances?.addresses?.shielded) {
        try {
          const checkAddress = currentAddresses?.shielded || sdkBalances?.addresses?.shielded;
          const checkUnshielded = currentAddresses?.unshielded || sdkBalances?.addresses?.unshielded || checkAddress;
          
          const [shieldedBalance, unshieldedBalance] = await Promise.all([
            getBalance(network, checkAddress),
            getBalance(network, checkUnshielded),
          ]);
          rpcBalances = combineBalances(shieldedBalance, unshieldedBalance);
        } catch (err) {
          console.warn('[Luna] RPC GET_BALANCES failed:', err);
        }
      }

      const finalNight = (rpcBalances && BigInt(rpcBalances.night) > 0) ? rpcBalances.night : (sdkBalances?.night?.total || '0');
      const finalDust = sdkBalances?.dust || '0';

      sendResponse({
        success: true,
        balances: {
          night: finalNight,
          dust: finalDust,
        },
        addresses: sdkBalances?.addresses || currentAddresses,
      });
    } catch (err: any) {
      sendResponse({ success: false, error: err?.message || 'Failed to get balances' });
    }
  })();
}

function handleGenerateDust(payload: { dustAddress?: string } | undefined, sendResponse: (r: any) => void) {
  void (async () => {
    try {
      const [privateKey, network, addresses] = await Promise.all([
        getSessionPrivateKey(),
        getStoredNetwork(),
        getStoredAddresses(),
      ]);

      if (!privateKey) {
        sendResponse({ success: false, error: 'Wallet is locked. Unlock to generate DUST.' });
        return;
      }

      const dustAddress = payload?.dustAddress || addresses?.dust || addresses?.unshielded || addresses?.shielded;
      if (!dustAddress) {
        sendResponse({ success: false, error: 'No wallet address found.' });
        return;
      }

      await ensureOffscreenReady();
      const result = await requestOffscreen<{ txHash: string; utxoCount: number; dustAddress: string }>(
        'GENERATE_DUST',
        { network, privateKey, dustAddress },
      );
      sendResponse({ success: true, ...result });
    } catch (err: any) {
      sendResponse({ success: false, error: err?.message || 'Failed to generate DUST' });
    }
  })();
}

function handleSendTransaction(
  payload: { to?: string; amount?: string; token?: string; memo?: string },
  sendResponse: (r: any) => void,
) {
  void (async () => {
    try {
      const privateKey = await getSessionPrivateKey();
      if (!privateKey) {
        sendResponse({ success: false, error: 'Wallet is locked. Unlock to send transactions.' });
        return;
      }

      const network = await getStoredNetwork();
      const token = payload?.token || 'NIGHT';
      if (token !== 'NIGHT') {
        throw new Error('Only NIGHT transfers are supported in Luna right now.');
      }

      if (!payload?.to || !payload?.amount) {
        throw new Error('Recipient and amount are required.');
      }

      await ensureOffscreenReady();
      const result = await requestOffscreen<{ txHash: string }>('SEND_TRANSACTION', {
        network,
        privateKey,
        to: payload.to,
        amount: payload.amount,
      });
      sendResponse({ success: true, txHash: result.txHash });
    } catch (err: any) {
      sendResponse({ success: false, error: err?.message || 'Failed to send transaction' });
    }
  })();
}

async function handleApproveConnection(payload: { id: string }, sendResponse: (r: any) => void) {
  const conn = pendingConnections.get(payload.id);
  if (!conn) {
    sendResponse({ success: false, error: 'Connection request not found' });
    return;
  }

  const [address, network] = await Promise.all([getStoredAddress(), getStoredNetwork()]);
  if (!address) {
    (conn as any)._resolved = { success: false, error: 'No wallet address found. Unlock or create wallet first.' };
    sendResponse({ success: false, error: 'No wallet address found' });
    return;
  }

  approvedOrigins.add(conn.origin);
  (conn as any)._resolved = { success: true, address, network };
  sendResponse({ success: true });
}

function handleRejectConnection(payload: { id: string }, sendResponse: (r: any) => void) {
  const conn = pendingConnections.get(payload.id);
  if (conn) {
    (conn as any)._resolved = { success: false, error: 'User rejected connection' };
  }
  sendResponse({ success: true });
}

function handleApproveTx(payload: { id: string }, sendResponse: (r: any) => void) {
  void (async () => {
    const tx = pendingTransactions.get(payload.id);
    if (!tx) {
      sendResponse({ success: false, error: 'Transaction request not found' });
      return;
    }

    try {
      const txHash = await submitTransactionViaBackend(tx);
      (tx as any)._resolved = { success: true, txHash };
      sendResponse({ success: true, txHash });
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to submit transaction';
      (tx as any)._resolved = { success: false, error: errorMessage };
      sendResponse({ success: false, error: errorMessage });
    }
  })();
}

function handleRejectTx(payload: { id: string }, sendResponse: (r: any) => void) {
  const tx = pendingTransactions.get(payload.id);
  if (tx) {
    (tx as any)._resolved = { success: false, error: 'User rejected transaction' };
  }
  sendResponse({ success: true });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getStoredAddress(): Promise<string | null> {
  const result = await chrome.storage.local.get('luna_address');
  return result.luna_address || null;
}

async function getStoredAddresses(): Promise<{ shielded: string; unshielded: string; dust: string } | null> {
  const result = await chrome.storage.local.get(['luna_address', 'luna_addresses']);
  const address = result.luna_address || null;
  const addresses = result.luna_addresses || null;

  if (addresses?.shielded) {
    return {
      shielded: addresses.shielded,
      unshielded: addresses.unshielded || addresses.shielded,
      dust: addresses.dust || addresses.shielded,
    };
  }

  if (!address) {
    return null;
  }

  return {
    shielded: address,
    unshielded: address,
    dust: address,
  };
}


async function getSessionPrivateKey(): Promise<string | null> {
  const result = await chrome.storage.session.get('luna_session_private_key');
  return result.luna_session_private_key || null;
}

async function getStoredNetwork(): Promise<'mainnet' | 'preprod' | 'preview' | 'undeployed'> {
  const result = await chrome.storage.local.get('luna_network');
  const network = result.luna_network as string | undefined;
  if (network === 'mainnet' || network === 'preprod' || network === 'preview' || network === 'undeployed') {
    return network;
  }
  return 'undeployed';
}

async function submitTransactionViaBackend(tx: PendingTransaction): Promise<string> {
  const [privateKey, network] = await Promise.all([
    getSessionPrivateKey(),
    getStoredNetwork(),
  ]);

  if (!privateKey) throw new Error('Wallet is locked. Unlock to send transactions.');

  await ensureOffscreenReady();
  const response = await requestOffscreen<{ txHash: string }>('SEND_TRANSACTION', {
    network,
    privateKey,
    to: tx.to,
    amount: tx.amount,
  });

  const txHash = response?.txHash;
  if (!txHash) throw new Error('Network did not return a transaction hash');
  return txHash;
}

function parseAmount(value: string | undefined): bigint {
  if (!value) return BigInt(0);
  try {
    return BigInt(value);
  } catch {
    return BigInt(0);
  }
}

function combineBalances(...balances: BalanceResponse[]) {
  let night = BigInt(0);
  let dust = BigInt(0);

  for (const balance of balances) {
    const parts = [balance.shielded, balance.unshielded, balance];
    for (const part of parts) {
      if (!part) continue;
      night += parseAmount(part.night);
      dust += parseAmount(part.dust);
    }
  }

  return {
    night: night.toString(),
    dust: dust.toString(),
  };
}

async function signDataWithSessionKey(data: string, privateKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyBytes = encoder.encode(privateKey.toLowerCase());
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const payload = encoder.encode(data);
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, payload);
  const hex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `0x${hex}`;
}

function waitForResponse(id: string, map: Map<string, any>, timeout: number): Promise<any> {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = setInterval(() => {
      const item = map.get(id);
      if (item?._resolved) {
        clearInterval(check);
        map.delete(id);
        resolve(item._resolved);
      }
      if (Date.now() - start > timeout) {
        clearInterval(check);
        map.delete(id);
        resolve({ error: 'Request timed out' });
      }
    }, 300);
  });
}

async function ensureOffscreenDocument(): Promise<void> {
  if (hasOffscreenPort()) {
    return;
  }

  const offscreenUrl = chrome.runtime.getURL('offscreen.html');
  const runtimeWithContexts = chrome.runtime as typeof chrome.runtime & {
    getContexts?: (query: { contextTypes: string[]; documentUrls?: string[] }) => Promise<Array<{ contextType: string }>>;
  };

  if (runtimeWithContexts.getContexts) {
    const contexts = await runtimeWithContexts.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [offscreenUrl],
    });

    if (contexts.length > 0) {
      return;
    }
  }

  if (!creatingOffscreenPromise) {
    const offscreenApi = (chrome as any).offscreen;
    if (!offscreenApi?.createDocument) {
      throw new Error('Chrome offscreen API is unavailable in this browser');
    }

    creatingOffscreenPromise = offscreenApi.createDocument({
      url: 'offscreen.html',
      reasons: ['WORKERS'],
      justification: 'Host Midnight SDK and WebAssembly outside the extension service worker',
    }).catch((error: any) => {
      const message = String(error?.message || error || '');
      if (!message.toLowerCase().includes('exists')) {
        throw error;
      }
    }).finally(() => {
      creatingOffscreenPromise = null;
    });
  }

  await creatingOffscreenPromise;
}

async function ensureOffscreenReady(): Promise<void> {
  await ensureOffscreenDocument();
  await waitForOffscreenReady();
}

// ── Alarm for cleanup ─────────────────────────────────────────────────────────
chrome.alarms.create('cleanup', { periodInMinutes: 5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cleanup') {
    const now = Date.now();
    pendingConnections.forEach((conn, id) => {
      if (now - conn.timestamp > 5 * 60 * 1000) pendingConnections.delete(id);
    });
    pendingTransactions.forEach((tx, id) => {
      if (now - tx.timestamp > 5 * 60 * 1000) pendingTransactions.delete(id);
    });
  }
});

console.log('[Luna] Background service worker initialized 🌑');

export {};
