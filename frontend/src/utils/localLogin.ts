import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';

export interface LocalLoginRecord {
  email: string;
  encryptedPrivateKey: string;
  version: number;
  updatedAt: number;
}

const LOCAL_LOGIN_KEY = 'luna_local_login';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function readLocalLogin(): Promise<LocalLoginRecord | null> {
  const value = await idbGet(LOCAL_LOGIN_KEY);
  if (!value || typeof value !== 'object') return null;

  const record = value as Partial<LocalLoginRecord>;
  if (!record.email || !record.encryptedPrivateKey) return null;

  return {
    email: normalizeEmail(record.email),
    encryptedPrivateKey: record.encryptedPrivateKey,
    version: Number(record.version || 1),
    updatedAt: Number(record.updatedAt || Date.now()),
  };
}

export async function writeLocalLogin(email: string, encryptedPrivateKey: string): Promise<void> {
  const payload: LocalLoginRecord = {
    email: normalizeEmail(email),
    encryptedPrivateKey,
    version: 1,
    updatedAt: Date.now(),
  };

  await idbSet(LOCAL_LOGIN_KEY, payload);
}

export async function clearLocalLogin(): Promise<void> {
  await idbDel(LOCAL_LOGIN_KEY);
}

export function localLoginMatchesEmail(record: LocalLoginRecord | null, email: string): boolean {
  if (!record) return false;
  return record.email === normalizeEmail(email);
}
