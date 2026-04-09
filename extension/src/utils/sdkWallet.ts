export type RuntimeNetwork = 'mainnet' | 'preprod' | 'preview' | 'undeployed' | 'localnet';

const NIGHT_TOKEN_TYPE = '0000000000000000000000000000000000000000000000000000000000000000';
const TOKEN_DECIMALS = 6;
const PROVING_SERVER_URL = 'http://localhost:6300';
const encoder = new TextEncoder();

type SdkModules = {
  abstractions: any;
  addressFormat: any;
  ledger: any;
  facade: any;
  shielded: any;
  unshielded: any;
  dust: any;
};

type WalletSession = {
  facade: any;
  addressFormat: any;
  modules: SdkModules;
  shieldedSecretKeys: any;
  dustSecretKey: any;
  unshieldedKeystore: any;
  formatNetworkId: any;
  networkId: any;
  stop: () => Promise<void>;
};

let sdkModulesPromise: Promise<SdkModules> | null = null;

function normalizeNetwork(network: RuntimeNetwork): 'mainnet' | 'preprod' | 'preview' | 'undeployed' {
  return network === 'localnet' ? 'undeployed' : network;
}

function parseAtomicAmount(value: string): bigint {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('Enter an amount');
  }

  if (/^-?\d+$/.test(trimmed)) {
    return BigInt(trimmed);
  }

  const match = trimmed.match(/^(\d+)(?:\.(\d+))?$/);
  if (!match) {
    throw new Error('Enter a valid amount');
  }

  const whole = match[1] || '0';
  const fraction = (match[2] || '').padEnd(TOKEN_DECIMALS, '0');
  if (fraction.length > TOKEN_DECIMALS) {
    throw new Error(`Amount supports up to ${TOKEN_DECIMALS} decimals`);
  }

  const wholePart = BigInt(whole) * BigInt(10 ** TOKEN_DECIMALS);
  const fractionPart = BigInt(fraction || '0');
  return wholePart + fractionPart;
}

async function deterministicSeed32(privateKey: string, network: string, purpose: 'zswap' | 'unshielded' | 'dust'): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(`luna-wallet-seed-v1${privateKey.toLowerCase()}`));
  return new Uint8Array(digest);
}

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (normalized.length % 2 !== 0) {
    throw new Error('Hex input must have an even number of characters');
  }

  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = parseInt(normalized.slice(i, i + 2), 16);
  }
  return bytes;
}

async function getRootSeed(privateKey: string): Promise<Uint8Array> {
  const normalized = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
  if (/^[0-9a-fA-F]{64}$/.test(normalized)) {
    return hexToBytes(normalized);
  }

  return deterministicSeed32(privateKey, '', 'zswap');
}

async function deriveRoleSeeds(modules: SdkModules, privateKey: string) {
  const { HDWallet, Roles } = await import('@midnight-ntwrk/wallet-sdk-hd');
  const rootSeed = await getRootSeed(privateKey);
  const wallet = HDWallet.fromSeed(rootSeed);

  if (wallet.type !== 'seedOk') {
    throw new Error('Failed to initialize HD wallet');
  }

  const derived = wallet.hdWallet
    .selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0);

  wallet.hdWallet.clear();

  if (derived.type !== 'keysDerived') {
    throw new Error('Failed to derive Midnight wallet keys');
  }

  return {
    zswapSeed: derived.keys[Roles.Zswap] as Uint8Array,
    unshieldedSeed: derived.keys[Roles.NightExternal] as Uint8Array,
    dustSeed: derived.keys[Roles.Dust] as Uint8Array,
  };
}

async function ensureBufferGlobal(): Promise<void> {
  if (typeof (globalThis as any).Buffer !== 'undefined') {
    return;
  }

  const { Buffer } = await import('buffer');
  (globalThis as any).Buffer = Buffer;
}

async function loadSdkModules(): Promise<SdkModules> {
  if (!sdkModulesPromise) {
    sdkModulesPromise = (async () => {
      await ensureBufferGlobal();

      const [
        abstractions,
        addressFormat,
        ledger,
        facade,
        shielded,
        unshielded,
        dust,
      ] = await Promise.all([
        import('@midnight-ntwrk/wallet-sdk-abstractions'),
        import('@midnight-ntwrk/wallet-sdk-address-format'),
        import('@midnight-ntwrk/ledger-v8'),
        import('@midnight-ntwrk/wallet-sdk-facade'),
        import('@midnight-ntwrk/wallet-sdk-shielded'),
        import('@midnight-ntwrk/wallet-sdk-unshielded-wallet'),
        import('@midnight-ntwrk/wallet-sdk-dust-wallet'),
      ]);

      return {
        abstractions,
        addressFormat,
        ledger,
        facade,
        shielded,
        unshielded,
        dust,
      };
    })();
  }

  return sdkModulesPromise;
}

function getEnvironmentConfiguration(network: ReturnType<typeof normalizeNetwork>, modules: SdkModules) {
  const { NetworkId } = modules.abstractions;
  const { mainnet } = modules.addressFormat;

  const configMap = {
    mainnet: {
      networkId: NetworkId.NetworkId.MainNet,
      formatNetworkId: mainnet,
      indexerHttpUrl: 'https://indexer.mainnet.midnight.network/api/v4/graphql',
      indexerWsUrl: 'wss://indexer.mainnet.midnight.network/api/v4/graphql/ws',
      nodeWsUrl: 'wss://rpc.mainnet.midnight.network',
    },
    preprod: {
      networkId: NetworkId.NetworkId.PreProd,
      formatNetworkId: 'preprod',
      indexerHttpUrl: 'https://indexer.preprod.midnight.network/api/v4/graphql',
      indexerWsUrl: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
      nodeWsUrl: 'wss://rpc.preprod.midnight.network',
    },
    preview: {
      networkId: NetworkId.NetworkId.Preview,
      formatNetworkId: 'preview',
      indexerHttpUrl: 'https://indexer.preview.midnight.network/api/v4/graphql',
      indexerWsUrl: 'wss://indexer.preview.midnight.network/api/v4/graphql/ws',
      nodeWsUrl: 'wss://rpc.preview.midnight.network',
    },
    undeployed: {
      networkId: NetworkId.NetworkId.Undeployed,
      formatNetworkId: 'undeployed',
      indexerHttpUrl: 'http://127.0.0.1:8088/api/v3/graphql',
      indexerWsUrl: 'ws://127.0.0.1:8088/api/v3/graphql/ws',
      nodeWsUrl: 'ws://127.0.0.1:9944',
    },
  } as const;

  const selected = configMap[network];
  return {
    ...selected,
    provingServerUrl: PROVING_SERVER_URL,
    costParameters: { feeBlocksMargin: 5 },
  };
}

let activeSession: WalletSession | null = null;
let activeNetwork: RuntimeNetwork | null = null;
let activePrivateKey: string | null = null;
let isStartingSession = false;

async function getSession(network: RuntimeNetwork, privateKey: string): Promise<WalletSession> {
  while (isStartingSession) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  if (activeSession) {
    if (activeNetwork === network && activePrivateKey === privateKey) {
      return activeSession;
    }
    isStartingSession = true;
    try {
      await activeSession.stop().catch(() => {});
    } finally {
      activeSession = null;
      isStartingSession = false;
    }
  }
  
  isStartingSession = true;
  try {
    const session = await startWalletSession(network, privateKey);
    activeSession = session;
    activeNetwork = network;
    activePrivateKey = privateKey;
    return session;
  } finally {
    isStartingSession = false;
  }
}

async function startWalletSession(network: RuntimeNetwork, privateKey: string): Promise<WalletSession> {
  const modules = await loadSdkModules();
  const normalized = normalizeNetwork(network);
  const env = getEnvironmentConfiguration(normalized, modules);
  const { zswapSeed, unshieldedSeed, dustSeed } = await deriveRoleSeeds(modules, privateKey);

  const shieldedSecretKeys = modules.ledger.ZswapSecretKeys.fromSeed(zswapSeed);
  const dustSecretKey = modules.ledger.DustSecretKey.fromSeed(dustSeed);
  const unshieldedKeystore = modules.unshielded.createKeystore(unshieldedSeed, env.networkId);

  const configuration = {
    networkId: env.networkId,
    indexerClientConnection: {
      indexerHttpUrl: env.indexerHttpUrl,
      indexerWsUrl: env.indexerWsUrl,
    },
    provingServerUrl: new URL(env.provingServerUrl),
    relayURL: new URL(env.nodeWsUrl),
    costParameters: env.costParameters,
    txHistoryStorage: new modules.unshielded.InMemoryTransactionHistoryStorage(),
  };

  const facade = await modules.facade.WalletFacade.init({
    configuration,
    shielded: (cfg: any) => modules.shielded.ShieldedWallet(cfg).startWithSeed(zswapSeed),
    unshielded: (cfg: any) =>
      modules.unshielded.UnshieldedWallet(cfg).startWithPublicKey(
        modules.unshielded.PublicKey.fromKeyStore(unshieldedKeystore),
      ),
    dust: (cfg: any) =>
      modules.dust.DustWallet(cfg).startWithSeed(
        dustSeed,
        modules.ledger.LedgerParameters.initialParameters().dust,
      ),
  });

  await facade.start(shieldedSecretKeys, dustSecretKey);

  return {
    facade,
    addressFormat: modules.addressFormat,
    modules,
    shieldedSecretKeys,
    dustSecretKey,
    unshieldedKeystore,
    formatNetworkId: env.formatNetworkId,
    networkId: env.networkId,
    stop: async () => {
      try {
        await facade.stop();
      } finally {
        shieldedSecretKeys.clear();
        shieldedSecretKeys.free();
        dustSecretKey.clear();
        dustSecretKey.free();
      }
    },
  };
}

function decodeTransferAddress(raw: string, session: WalletSession) {
  const parsed = session.addressFormat.MidnightBech32m.parse(raw);

  if (parsed.type === 'shield-addr') {
    return {
      type: 'shielded' as const,
      receiverAddress: session.addressFormat.ShieldedAddress.codec.decode(
        session.formatNetworkId,
        parsed,
      ),
    };
  }

  if (parsed.type === 'addr') {
    return {
      type: 'unshielded' as const,
      receiverAddress: session.addressFormat.UnshieldedAddress.codec.decode(
        session.formatNetworkId,
        parsed,
      ),
    };
  }

  throw new Error('Unsupported recipient address type');
}

function decodeDustAddress(raw: string, session: WalletSession) {
  const parsed = session.addressFormat.MidnightBech32m.parse(raw);
  return session.addressFormat.DustAddress.codec.decode(session.formatNetworkId, parsed);
}

export async function submitNightTransactionWithSdk(
  network: RuntimeNetwork,
  privateKey: string,
  tx: { to: string; amount: string },
): Promise<{ txHash: string }> {
  const session = await getSession(network, privateKey);

  await session.facade.waitForSyncedState();

  const output = decodeTransferAddress(tx.to, session);
  const recipe = await session.facade.transferTransaction(
    [
      {
        type: output.type,
        outputs: [
          {
            type: NIGHT_TOKEN_TYPE,
            receiverAddress: output.receiverAddress,
            amount: parseAtomicAmount(tx.amount),
          },
        ],
      },
    ],
    {
      shieldedSecretKeys: session.shieldedSecretKeys,
      dustSecretKey: session.dustSecretKey,
    },
    {
      ttl: new Date(Date.now() + 30 * 60 * 1000),
    },
  );

  const signedRecipe = await session.facade.signRecipe(
    recipe,
    (payload: Uint8Array) => session.unshieldedKeystore.signData(payload),
  );
  const finalized = await session.facade.finalizeRecipe(signedRecipe);
  const txHash = await session.facade.submitTransaction(finalized);
  return { txHash };
}

function stringifyTokenBalance(value: unknown): string {
  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'number') {
    return Math.trunc(value).toString();
  }

  if (typeof value === 'string') {
    return value;
  }

  return '0';
}

export async function getWalletBalancesWithSdk(
  network: RuntimeNetwork,
  privateKey: string,
): Promise<{
  addresses: { shielded: string; unshielded: string; dust: string };
  night: { shielded: string; unshielded: string; total: string };
  dust: string;
}> {
  const session = await getSession(network, privateKey);

  const state = await session.facade.waitForSyncedState();
  const shieldedNight = stringifyTokenBalance(state?.shielded?.balances?.[NIGHT_TOKEN_TYPE]);

  const availableNightCoins = state?.unshielded?.availableCoins?.filter((c: any) => c?.utxo?.type === NIGHT_TOKEN_TYPE) || [];
  let unshieldedNightInt = BigInt(0);
  for (const c of availableNightCoins) {
    unshieldedNightInt += BigInt(c.utxo?.value || 0);
  }
  const unshieldedNight = unshieldedNightInt.toString();

  let dustBalance = '0';
  try {
    dustBalance = stringifyTokenBalance(state?.dust?.balance?.(new Date()));
  } catch {
    dustBalance = '0';
  }

  const shieldedAddress = state?.shielded?.address
    ? session.addressFormat.MidnightBech32m.encode(session.networkId, state.shielded.address).toString()
    : '';
  const unshieldedAddress = state?.unshielded?.address
    ? session.addressFormat.MidnightBech32m.encode(session.networkId, state.unshielded.address).toString()
    : session.unshieldedKeystore.getBech32Address().asString();
  const dustAddress = state?.dust?.publicKey
    ? session.addressFormat.DustAddress.encodePublicKey(session.networkId, state.dust.publicKey)
    : '';

  return {
    addresses: {
      shielded: shieldedAddress,
      unshielded: unshieldedAddress,
      dust: dustAddress,
    },
    night: {
      shielded: shieldedNight,
      unshielded: unshieldedNight,
      total: (BigInt(shieldedNight) + BigInt(unshieldedNight)).toString(),
    },
    dust: dustBalance,
  };
}

export async function registerDustWithSdk(
  network: RuntimeNetwork,
  privateKey: string,
  dustAddress: string,
): Promise<{ txHash: string; utxoCount: number; dustAddress: string }> {
  const session = await getSession(network, privateKey);

  const syncedState = await session.facade.waitForSyncedState();
  const availableNightUtxos = syncedState.unshielded.availableCoins.filter((coin: any) =>
    coin?.utxo?.type === NIGHT_TOKEN_TYPE && !coin?.meta?.registeredForDustGeneration,
  );

  if (!availableNightUtxos.length) {
    throw new Error('No spendable NIGHT UTXOs are available for DUST registration on this network.');
  }

  const recipe = await session.facade.registerNightUtxosForDustGeneration(
    availableNightUtxos,
    session.unshieldedKeystore.getPublicKey(),
    (payload: Uint8Array) => session.unshieldedKeystore.signData(payload),
    decodeDustAddress(dustAddress, session),
  );

  const finalized = await session.facade.finalizeRecipe(recipe);
  const txHash = await session.facade.submitTransaction(finalized);
  return { txHash, utxoCount: availableNightUtxos.length, dustAddress };
}
