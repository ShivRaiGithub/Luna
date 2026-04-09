import crypto from 'crypto';

const PBKDF2_ITERATIONS = 100000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const KEY_BYTES = 32;

function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_BYTES, 'sha256');
}

export function encryptKey(privateKey: string, password: string): string {
  const salt = crypto.randomBytes(SALT_BYTES);
  const iv = crypto.randomBytes(IV_BYTES);
  const key = deriveKey(password, salt);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(privateKey, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([salt, iv, encrypted, tag]).toString('base64');
}

export function decryptKey(encryptedData: string, password: string): string {
  const combined = Buffer.from(encryptedData, 'base64');
  if (combined.length <= SALT_BYTES + IV_BYTES + 16) {
    throw new Error('Invalid encrypted payload');
  }

  const salt = combined.subarray(0, SALT_BYTES);
  const iv = combined.subarray(SALT_BYTES, SALT_BYTES + IV_BYTES);
  const body = combined.subarray(SALT_BYTES + IV_BYTES);
  const ciphertext = body.subarray(0, body.length - 16);
  const tag = body.subarray(body.length - 16);

  const key = deriveKey(password, salt);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

export function splitString(value: string): [string, string] {
  const mid = Math.floor(value.length / 2);
  return [value.slice(0, mid), value.slice(mid)];
}

export function combineStrings(a: string, b: string): string {
  return `${a || ''}${b || ''}`;
}
