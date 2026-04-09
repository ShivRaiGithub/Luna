import { loadLedger } from './ledgerBrowser';
import { createKeystore } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import {
  DustAddress,
  ShieldedAddress,
  ShieldedCoinPublicKey,
  ShieldedEncryptionPublicKey,
  mainnet as mainnetSymbol,
} from '@midnight-ntwrk/wallet-sdk-address-format';
import { NetworkId } from '@midnight-ntwrk/wallet-sdk-abstractions';

export type WalletNetwork = 'mainnet' | 'preprod' | 'preview' | 'undeployed' | 'localnet';

export interface AddressSet {
  shielded: string;
  unshielded: string;
  dust: string;
}

const encoder = new TextEncoder();

function normalizeNetwork(network: WalletNetwork): 'mainnet' | 'preprod' | 'preview' | 'undeployed' {
  return network === 'localnet' ? 'undeployed' : network;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function ensureBufferGlobal(): Promise<void> {
  if (typeof (globalThis as any).Buffer !== 'undefined') {
    return;
  }

  const { Buffer } = await import('buffer');
  (globalThis as any).Buffer = Buffer;
}

function getSdkNetworkId(network: ReturnType<typeof normalizeNetwork>) {
  switch (network) {
    case 'mainnet':
      return NetworkId.NetworkId.MainNet;
    case 'preprod':
      return NetworkId.NetworkId.PreProd;
    case 'preview':
      return NetworkId.NetworkId.Preview;
    case 'undeployed':
      return NetworkId.NetworkId.Undeployed;
  }
}

function getFormatNetworkId(network: ReturnType<typeof normalizeNetwork>) {
  return network === 'mainnet' ? mainnetSymbol : network;
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

async function sha256(parts: string[]): Promise<Uint8Array> {
  const joined = parts.join('');
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(joined));
  return new Uint8Array(digest);
}

async function getRootSeed(privateKey?: string): Promise<Uint8Array> {
  if (!privateKey) {
    return randomSeed32();
  }

  const normalized = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
  if (/^[0-9a-fA-F]{64}$/.test(normalized)) {
    return hexToBytes(normalized);
  }

  return sha256(['luna-wallet-seed-v1', privateKey.toLowerCase()]);
}

function deriveRoleSeeds(rootSeed: Uint8Array) {
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

function randomSeed32(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

export async function deriveAddresses(network: WalletNetwork, privateKey?: string): Promise<AddressSet> {
  const normalizedNetwork = normalizeNetwork(network);
  const rootSeed = await getRootSeed(privateKey);
  const { zswapSeed, unshieldedSeed, dustSeed } = deriveRoleSeeds(rootSeed);

  await ensureBufferGlobal();
  const ledger = await loadLedger();
  const zswapKeys = ledger.ZswapSecretKeys.fromSeed(zswapSeed);
  const dustSecret = ledger.DustSecretKey.fromSeed(dustSeed);
  const sdkNetworkId = getSdkNetworkId(normalizedNetwork);
  const formatNetworkId = getFormatNetworkId(normalizedNetwork);
  const unshieldedKeystore = createKeystore(unshieldedSeed, sdkNetworkId);

  try {
    const shieldedAddress = new ShieldedAddress(
      new ShieldedCoinPublicKey((globalThis as any).Buffer.from(hexToBytes(zswapKeys.coinPublicKey))),
      new ShieldedEncryptionPublicKey((globalThis as any).Buffer.from(hexToBytes(zswapKeys.encryptionPublicKey))),
    );

    return {
      shielded: ShieldedAddress.codec.encode(formatNetworkId, shieldedAddress).asString(),
      unshielded: unshieldedKeystore.getBech32Address().asString(),
      dust: DustAddress.encodePublicKey(normalizedNetwork, dustSecret.publicKey),
    };
  } finally {
    zswapKeys.clear();
    zswapKeys.free();
    dustSecret.clear();
    dustSecret.free();
  }
}

export function isLikelyMidnightAddress(address: string | undefined): boolean {
  if (!address) return false;
  return address.startsWith('mn');
}

export function getAddressDebugFingerprint(addresses: AddressSet): string {
  return bytesToHex(encoder.encode(addresses.shielded)).slice(0, 16);
}
