// Crypto utilities for Luna Wallet

export function generatePrivateKey(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return '0x' + Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function encryptKey(privateKey: string, password: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const aesKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    enc.encode(privateKey)
  );

  // Combine salt + iv + ciphertext as base64
  const encBytes = new Uint8Array(encrypted);
  const combined = new Uint8Array(salt.length + iv.length + encBytes.length);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(encBytes, salt.length + iv.length);
  return btoa(Array.from(combined).map(b => String.fromCharCode(b)).join(''));
}

export async function decryptKey(encryptedData: string, password: string): Promise<string> {
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  
  const combined = new Uint8Array(
    Array.from(atob(encryptedData)).map(c => c.charCodeAt(0))
  );

  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const ciphertext = combined.slice(28);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const aesKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    ciphertext
  );

  return dec.decode(decrypted);
}

export function shortenAddress(address: string, chars = 6): string {
  if (!address) return '';
  return `${address.slice(0, chars)}...${address.slice(-4)}`;
}

export function formatAmount(amount: string, displayDecimals = 6, tokenDecimals = 6): string {
  if (!amount) {
    return (0).toFixed(displayDecimals);
  }

  let raw: bigint;
  try {
    raw = BigInt(amount);
  } catch {
    return (0).toFixed(displayDecimals);
  }

  const negative = raw < BigInt(0);
  const absolute = negative ? -raw : raw;
  const divisor = BigInt(tokenDecimals === 0 ? '1' : '1' + '0'.repeat(tokenDecimals));
  const whole = absolute / divisor;
  const fraction = absolute % divisor;
  const fractionText = fraction.toString().padStart(tokenDecimals, '0');
  const visibleFraction = tokenDecimals === 0
    ? ''
    : fractionText.slice(0, displayDecimals).padEnd(displayDecimals, '0');

  if (displayDecimals === 0) {
    return `${negative ? '-' : ''}${whole.toString()}`;
  }

  return `${negative ? '-' : ''}${whole.toString()}.${visibleFraction}`;
}






export function splitString(str: string): [string, string] {
  if (!str) return ['', ''];
  const mid = Math.floor(str.length / 2);
  return [str.substring(0, mid), str.substring(mid)];
}

export function combineStrings(part1: string, part2: string): string {
  return (part1 || '') + (part2 || '');
}
