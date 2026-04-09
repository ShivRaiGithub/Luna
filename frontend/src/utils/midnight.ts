/**
 * Luna  direct Midnight client utilities.
 * Backend is intentionally not used for wallet/network operations.
 */

export type NetworkId = 'mainnet' | 'preprod' | 'preview' | 'undeployed';
export type RuntimeNetwork = NetworkId | 'localnet';

export interface BalanceResponse {
  night?: string;
  dust?: string;
  shielded?: { night?: string; dust?: string };
  unshielded?: { night?: string; dust?: string };
  unavailable?: boolean;
  reason?: string;
  source?: string;
  scannedBlocks?: number;
}

const RPC_ENDPOINTS: Record<NetworkId, string> = {
  mainnet: 'https://rpc.mainnet.midnight.network',
  preprod: 'https://rpc.preprod.midnight.network',
  preview: 'https://rpc.preview.midnight.network',
  undeployed: 'http://localhost:9944',
};

const INDEXER_ENDPOINTS: Partial<Record<NetworkId, string>> = {
  undeployed: 'http://127.0.0.1:8088/api/v3/graphql',
};

const NIGHT_TOKEN_TYPE = '0000000000000000000000000000000000000000000000000000000000000000';

interface RpcRequest {
  method: string;
  params?: unknown[];
}

interface RpcResponse<T = unknown> {
  result?: T;
  error?: { code?: number; message?: string };
}

function normalizeNetwork(network: RuntimeNetwork): NetworkId {
  return network === 'localnet' ? 'undeployed' : network;
}

function getRpcEndpoint(network: RuntimeNetwork): string {
  return RPC_ENDPOINTS[normalizeNetwork(network)];
}

function getIndexerEndpoint(network: RuntimeNetwork): string | null {
  return INDEXER_ENDPOINTS[normalizeNetwork(network)] || null;
}

function parseAmount(value: string | undefined): bigint {
  if (!value) return BigInt(0);
  try {
    return BigInt(value);
  } catch {
    return BigInt(0);
  }
}

async function rpc<T>(network: RuntimeNetwork, req: RpcRequest): Promise<T> {
  const res = await fetch(getRpcEndpoint(network), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), ...req }),
  });

  const data: RpcResponse<T> = await res.json();
  if (!res.ok) {
    throw new Error(`RPC HTTP ${res.status}`);
  }
  if (data.error) {
    throw new Error(data.error.message || `RPC ${req.method} failed`);
  }
  return data.result as T;
}

async function indexerQuery<T>(network: RuntimeNetwork, query: string): Promise<T> {
  const url = getIndexerEndpoint(network);
  if (!url) {
    throw new Error('No indexer configured for network');
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  const payload = await res.json() as { data?: T; errors?: Array<{ message?: string }> };
  if (!res.ok) {
    throw new Error(`Indexer HTTP ${res.status}`);
  }
  if (payload.errors?.length) {
    throw new Error(payload.errors[0]?.message || 'Indexer query failed');
  }
  return payload.data as T;
}

async function getUndeployedBalanceFromIndexer(network: RuntimeNetwork, address: string): Promise<BalanceResponse> {
  const header = await rpc<any>(network, { method: 'chain_getHeader' });
  const blockHeightHex = typeof header?.number === 'string' ? header.number : null;
  const head = blockHeightHex ? parseInt(blockHeightHex, 16) : 0;
  const minHeight = Math.max(1, head - 500);
  let night = BigInt(0);
  let scanned = 0;

  for (let height = head; height >= minHeight; height -= 1) {
    const block = await indexerQuery<{
      block?: {
        transactions?: Array<{
          unshieldedCreatedOutputs?: Array<{ owner: string; value: string; tokenType: string }>;
          unshieldedSpentOutputs?: Array<{ owner: string; value: string; tokenType: string }>;
        }>;
      };
    }>(network, `query { block(offset: { height: ${height} }) { transactions { unshieldedCreatedOutputs { owner value tokenType } unshieldedSpentOutputs { owner value tokenType } } } }`);

    scanned += 1;
    const txs = block.block?.transactions || [];
    for (const tx of txs) {
      for (const out of tx.unshieldedCreatedOutputs || []) {
        if (out.owner === address && out.tokenType === NIGHT_TOKEN_TYPE) {
          night += parseAmount(out.value);
        }
      }
      for (const out of tx.unshieldedSpentOutputs || []) {
        if (out.owner === address && out.tokenType === NIGHT_TOKEN_TYPE) {
          night -= parseAmount(out.value);
        }
      }
    }
  }

  return {
    night: night > BigInt(0) ? night.toString() : '0',
    dust: '0',
    source: 'indexer-v3-fallback',
    scannedBlocks: scanned,
  };
}

export async function getBalance(network: RuntimeNetwork, address: string): Promise<BalanceResponse> {
  const normalized = normalizeNetwork(network);

  try {
    return await rpc<BalanceResponse>(normalized, {
      method: 'midnight_getBalance',
      params: [address],
    });
  } catch (rpcError) {
    if (normalized === 'undeployed') {
      try {
        return await getUndeployedBalanceFromIndexer(normalized, address);
      } catch {
        throw rpcError;
      }
    }

    return {
      night: '0',
      dust: '0',
      unavailable: true,
      reason: 'Balance by address is not directly exposed on this network RPC.',
    };
  }
}

export async function getTransactionHistory(network: RuntimeNetwork, address: string, limit = 20): Promise<any[]> {
  const normalized = normalizeNetwork(network);

  try {
    return await rpc<any[]>(normalized, {
      method: 'midnight_getTransactions',
      params: [address, limit],
    });
  } catch {
    return [];
  }
}

export async function submitTransaction(network: RuntimeNetwork, tx: Record<string, unknown>): Promise<{ txHash?: string; blockHeight?: number }> {
  if (normalizeNetwork(network) === 'undeployed') {
    throw new Error('Sending NIGHT on undeployed is not available from the browser wallet yet. The local node expects a signed extrinsic, so this flow still needs a client-side transaction builder/signer.');
  }

  return rpc(network, {
    method: 'midnight_submitTransaction',
    params: [tx],
  });
}

export async function requestDust(network: RuntimeNetwork, address: string): Promise<void> {
  const normalized = normalizeNetwork(network);
  const attempts = ['midnight_generateDust', 'midnight_faucet'];

  for (const method of attempts) {
    try {
      await rpc(network, { method, params: [address] });
      return;
    } catch {
      // Try next compatible method.
    }
  }

  if (normalized === 'undeployed') {
    throw new Error('Unable to generate DUST on undeployed from browser RPC alone. Use the local funding flow that registers NIGHT for DUST generation, or wire in the full dust-generation transaction builder.');
  }

  throw new Error('Unable to generate DUST on current network');
}

export async function getNetworkInfo(network: RuntimeNetwork): Promise<{ blockHeight: number | null; latencyMs: number; peerCount: number | null; chain?: string; isSyncing?: boolean }> {
  const startedAt = Date.now();
  const [health, chainName, header] = await Promise.all([
    rpc<any>(network, { method: 'system_health' }),
    rpc<string>(network, { method: 'system_chain' }),
    rpc<any>(network, { method: 'chain_getHeader' }),
  ]);

  const blockHeightHex = typeof header?.number === 'string' ? header.number : null;
  return {
    blockHeight: blockHeightHex ? parseInt(blockHeightHex, 16) : null,
    latencyMs: Date.now() - startedAt,
    peerCount: typeof health?.peers === 'number' ? health.peers : null,
    chain: chainName,
    isSyncing: Boolean(health?.isSyncing),
  };
}

export async function getNetworkStatuses(): Promise<Array<{ network: NetworkId; online: boolean; latencyMs: number | null; blockHeight?: number | null }>> {
  const entries = Object.keys(RPC_ENDPOINTS) as NetworkId[];
  return Promise.all(entries.map(async (network) => {
    try {
      const info = await getNetworkInfo(network);
      return {
        network,
        online: true,
        latencyMs: info.latencyMs,
        blockHeight: info.blockHeight,
      };
    } catch {
      return {
        network,
        online: false,
        latencyMs: null,
        blockHeight: null,
      };
    }
  }));
}
