import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

async function getToken(): Promise<string | null> {
  return await idbGet('luna_jwt') || null;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }
  return data.data ?? data;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  requestOTP: (email: string) =>
    request('/auth/request-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  verifyOTP: (email: string, otp: string) =>
    request<{ token: string; user: { id: string; email: string }; isNewUser: boolean; hasWallet: boolean }>(
      '/auth/verify-otp',
      { method: 'POST', body: JSON.stringify({ email, otp }) }
    ),

  login: (email: string) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  me: () => request<{ id: string; email: string; walletAddress?: string; hasWallet: boolean }>('/auth/me'),
};

// ── Wallet ────────────────────────────────────────────────────────────────────
export const walletApi = {
  /** Store server-side key shard halves (new wallet creation) */
  storeShards: (str1_1: string, str2_1: string) =>
    request('/wallet/store-shards', {
      method: 'POST',
      body: JSON.stringify({ str1_1, str2_1 }),
    }),

  /** Retrieve server-side key shard halves (requires OTP verification) */
  getShards: (otp: string) =>
    request<{ str1_1: string; str2_1: string }>('/wallet/get-shards', {
      method: 'POST',
      body: JSON.stringify({ otp }),
    }),

  /** Update shards after password reset (requires OTP verification) */
  updateShards: (str1_1: string, str2_1: string, otp: string) =>
    request('/wallet/update-shards', {
      method: 'POST',
      body: JSON.stringify({ str1_1, str2_1, otp }),
    }),

  /** Check if wallet shards exist for the authenticated user */
  checkWallet: () =>
    request<{ exists: boolean }>('/wallet/check'),
};

export async function setToken(token: string) {
  await idbSet('luna_jwt', token);
}

export async function clearToken() {
  await idbDel('luna_jwt');
}
