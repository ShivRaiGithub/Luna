import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AddressSet } from '../utils/addressDerivation';
import { getBalance, type BalanceResponse } from '../utils/midnight';

type Screen = 'loading' | 'onboard' | 'onboard_otp' | 'new_wallet' | 'download_backup' | 'existing_wallet' | 'existing_otp' | 'recover' | 'recover_otp' | 'forgot' | 'forgot_otp' | 'forgot_unlock' | 'locked' | 'wallet' | 'connect_request' | 'tx_request';
type Tab = 'home' | 'send' | 'receive' | 'settings';
type Network = 'mainnet' | 'preprod' | 'preview' | 'undeployed';
type TokenKind = 'NIGHT';

interface PendingConnectionPayload { id: string; origin: string; name: string; }
interface PendingTxPayload { id: string; sessionId?: string; to: string; amount: string; memo?: string; }
interface RequestState { kind: 'connect' | 'tx'; payload: PendingConnectionPayload | PendingTxPayload; }
interface BackupFile { str1_2: string; str2_2: string; email: string; version: number; }
interface LocalLoginRecord { email: string; encryptedPrivateKey: string; version: number; updatedAt: number; }

const API_BASE = 'http://localhost:3001';
const NETWORKS: Network[] = ['mainnet', 'preprod', 'preview', 'undeployed'];

function normalizeStoredNetwork(network: string | null | undefined): Network {
  if (network === 'localnet' || network === 'undeployed' || !network) return 'undeployed';
  if (network === 'mainnet' || network === 'preprod' || network === 'preview') return network;
  return 'undeployed';
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const ui = {
  shell: { width: 360, minHeight: 560, position: 'relative', overflow: 'hidden', background: 'radial-gradient(circle at 12% 10%, rgba(167,139,255,0.18), transparent 40%), radial-gradient(circle at 85% 90%, rgba(103,232,249,0.14), transparent 38%), #050817', color: '#e2e8f0', fontFamily: 'Exo 2, sans-serif' } as React.CSSProperties,
  card: { padding: 12, border: '1px solid rgba(148,163,184,0.35)', borderRadius: 12, background: 'rgba(15,23,42,0.72)', boxShadow: '0 8px 30px rgba(2,6,23,0.35)' } as React.CSSProperties,
  input: { padding: 10, borderRadius: 10, border: '1px solid rgba(148,163,184,0.35)', background: 'rgba(15,23,42,0.92)', color: '#e2e8f0', outline: 'none', width: '100%', boxSizing: 'border-box' as const } as React.CSSProperties,
  button: { padding: 10, borderRadius: 10, border: '1px solid rgba(148,163,184,0.35)', color: '#dbeafe', background: 'rgba(30,41,59,0.82)', fontWeight: 600, cursor: 'pointer', width: '100%' } as React.CSSProperties,
  buttonPrimary: { padding: 10, borderRadius: 10, border: 'none', color: '#020617', background: 'linear-gradient(135deg, #c4b5fd, #93c5fd)', fontWeight: 700, cursor: 'pointer', width: '100%' } as React.CSSProperties,
};

function shorten(address: string | null): string {
  if (!address) return '—';
  if (address.length < 20) return address;
  return `${address.slice(0, 10)}...${address.slice(-8)}`;
}

function formatAmount(atomicAmount: string | number, decimals: number = 4): string {
  if (!atomicAmount) return '0.0000';
  try {
    const valStr = BigInt(atomicAmount).toString();
    const tokenDecimals = 6;
    const padded = valStr.padStart(tokenDecimals + 1, '0');
    const whole = padded.slice(0, -tokenDecimals) || '0';
    const fraction = padded.slice(-tokenDecimals).slice(0, decimals);
    return `${whole}.${fraction.padEnd(decimals, '0')}`;
  } catch { return '0.0000'; }
}

function qrSrc(value: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=144x144&data=${encodeURIComponent(value)}`;
}

async function readStorage<T extends string>(keys: T[]): Promise<Record<T, any>> {
  return chrome.storage.local.get(keys) as Promise<Record<T, any>>;
}

async function writeStorage(values: Record<string, any>): Promise<void> {
  await chrome.storage.local.set(values);
}

async function readLocalLoginRecord(): Promise<LocalLoginRecord | null> {
  const store = await chrome.storage.local.get('luna_local_login');
  const raw = store.luna_local_login as Partial<LocalLoginRecord> | undefined;
  if (!raw?.email || !raw?.encryptedPrivateKey) return null;

  return {
    email: normalizeEmail(raw.email),
    encryptedPrivateKey: raw.encryptedPrivateKey,
    version: Number(raw.version || 1),
    updatedAt: Number(raw.updatedAt || Date.now()),
  };
}

async function writeLocalLoginRecord(email: string, encryptedPrivateKey: string): Promise<void> {
  const payload: LocalLoginRecord = {
    email: normalizeEmail(email),
    encryptedPrivateKey,
    version: 1,
    updatedAt: Date.now(),
  };
  await chrome.storage.local.set({ luna_local_login: payload });
}

function localLoginMatches(record: LocalLoginRecord | null, email: string): boolean {
  if (!record) return false;
  return record.email === normalizeEmail(email);
}

async function deriveAddressesViaBackground(network: Network, privateKey?: string): Promise<AddressSet> {
  const response = await chrome.runtime.sendMessage({ type: 'LUNA_DERIVE_ADDRESSES', payload: { network, privateKey } });
  if (!response?.success || !response.addresses) throw new Error(response?.error || 'Failed to derive addresses');
  return response.addresses as AddressSet;
}

async function apiRequest<T>(path: string, options: RequestInit = {}, token: string | null = null): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.success) throw new Error(body.error || `Request failed with ${res.status}`);
  return (body.data ?? body) as T;
}

async function decryptKey(encryptedData: string, password: string): Promise<string> {
  const enc = new TextEncoder(); const dec = new TextDecoder();
  const combined = new Uint8Array(Array.from(atob(encryptedData)).map((c) => c.charCodeAt(0)));
  const salt = combined.slice(0, 16); const iv = combined.slice(16, 28); const ciphertext = combined.slice(28);
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']);
  const aesKey = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ciphertext);
  return dec.decode(decrypted);
}

async function encryptKey(privateKey: string, password: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']);
  const salt = crypto.getRandomValues(new Uint8Array(16)); const iv = crypto.getRandomValues(new Uint8Array(12));
  const aesKey = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, enc.encode(privateKey));
  const encBytes = new Uint8Array(encrypted);
  const combined = new Uint8Array(salt.length + iv.length + encBytes.length);
  combined.set(salt, 0); combined.set(iv, salt.length); combined.set(encBytes, salt.length + iv.length);
  return btoa(Array.from(combined).map((b) => String.fromCharCode(b)).join(''));
}

function splitString(str: string): [string, string] {
  if (!str) return ['', ''];
  const mid = Math.floor(str.length / 2);
  return [str.substring(0, mid), str.substring(mid)];
}

function combineStrings(part1: string, part2: string): string {
  return (part1 || '') + (part2 || '');
}

function presentError(err: any): string {
  const message = String(err?.message || 'Request failed');
  const lower = message.toLowerCase();
  if (lower.includes('user not found') || lower.includes('invalid token') || lower.includes('unauthorized')) return 'Session expired. Sign in again.';
  if (lower.includes('failed to fetch') || lower.includes('networkerror')) return `Backend unreachable at ${API_BASE}`;
  return message;
}

function fallbackAddressSet(address: string): AddressSet { return { shielded: address, unshielded: address, dust: address }; }

function randomPrivateKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

async function copyText(value: string): Promise<void> {
  try { await navigator.clipboard.writeText(value); } catch {
    const textarea = document.createElement('textarea'); textarea.value = value; textarea.style.position = 'fixed'; textarea.style.opacity = '0';
    document.body.appendChild(textarea); textarea.focus(); textarea.select(); document.execCommand('copy'); document.body.removeChild(textarea);
  }
}

function parseAmount(value: string | undefined): bigint { if (!value) return BigInt(0); try { return BigInt(value); } catch { return BigInt(0); } }

function combineBalances(...balances: BalanceResponse[]) {
  let night = BigInt(0); let dust = BigInt(0);
  for (const balance of balances) { for (const part of [balance.shielded, balance.unshielded, balance]) { if (!part) continue; night += parseAmount(part.night); dust += parseAmount(part.dust); } }
  return { night: night.toString(), dust: dust.toString() };
}

function downloadBackupFile(content: string, email: string) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `luna-backup-${(email || 'wallet').replace(/[^a-z0-9._-]/gi, '_')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main Component ──────────────────────────────────────────────────────────

const PopupApp: React.FC = () => {
  const [screen, setScreen] = useState<Screen>('loading');
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [network, setNetwork] = useState<Network>('undeployed');
  const [token, setToken] = useState<string | null>(null);
  const [sessionPrivateKey, setSessionPrivateKey] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<AddressSet | null>(null);
  const [balance, setBalance] = useState('0');
  const [dustBalance, setDustBalance] = useState('0');
  const [isFetchingBalance, setIsFetchingBalance] = useState(false);
  const [statusText, setStatusText] = useState<string>('');
  const [busy, setBusy] = useState(false);

  // Auth state
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [backupPassInput, setBackupPassInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [uploadedBackup, setUploadedBackup] = useState<BackupFile | null>(null);
  const [backupFileContent, setBackupFileContent] = useState<string | null>(null);
  const [backupDownloaded, setBackupDownloaded] = useState(false);

  // Wallet state
  const [sendTo, setSendTo] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendMemo, setSendMemo] = useState('');
  const [sendToken, setSendToken] = useState<TokenKind>('NIGHT');
  const [pending, setPending] = useState<RequestState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stars = useMemo(() => Array.from({ length: 50 }, (_, i) => ({
    id: i, left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
    size: `${Math.random() * 2 + 1}px`, opacity: 0.35 + Math.random() * 0.5,
  })), []);

  // ── Helper functions ──────────────────────────────────────────────────

  async function ensureAddress(_t: string, net: Network, pk?: string): Promise<AddressSet> {
    const derived = await deriveAddressesViaBackground(net, pk);
    await writeStorage({ luna_address: derived.shielded, luna_addresses: derived, luna_network: net });
    return derived;
  }

  async function refreshBalance(_t: string, addr: string, net: Network, addrs?: AddressSet | null) {
    setIsFetchingBalance(true);
    try {
      const sdkRes = await chrome.runtime.sendMessage({ type: 'LUNA_GET_BALANCES' });
      if (sdkRes?.success && sdkRes?.balances) {
        if (sdkRes.addresses?.shielded) { setAddress(sdkRes.addresses.shielded); setAddresses(sdkRes.addresses as AddressSet); }
        setBalance(String(sdkRes.balances.night || '0')); setDustBalance(String(sdkRes.balances.dust || '0')); return;
      }
      const aSet = addrs || addresses || fallbackAddressSet(addr);
      const [sb, ub] = await Promise.all([getBalance(net, aSet.shielded), getBalance(net, aSet.unshielded || aSet.shielded)]);
      const merged = combineBalances(sb, ub);
      setBalance(merged.night);
    } catch (err: any) { setStatusText(presentError(err)); } finally { setIsFetchingBalance(false); }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string) as BackupFile;
        if (!parsed.str1_2 || !parsed.str2_2) { setStatusText('Invalid backup file'); return; }
        setUploadedBackup(parsed); setStatusText('✓ Backup file loaded');
      } catch { setStatusText('Could not parse backup file'); }
    };
    reader.readAsText(file);
  }

  // ── Boot ──────────────────────────────────────────────────────────────

  async function boot() {
    const stored = await readStorage(['luna_jwt', 'luna_email', 'luna_network', 'luna_address', 'luna_addresses', 'luna_unlocked']);
    const savedNetwork = normalizeStoredNetwork(stored.luna_network);
    setNetwork(savedNetwork);
    const savedToken = stored.luna_jwt || null;
    setToken(savedToken);
    setEmail(stored.luna_email || null);
    const localLogin = await readLocalLoginRecord();

    if (!savedToken) {
      if (localLogin && stored.luna_address) {
        setAddress(stored.luna_address || null);
        setAddresses(stored.luna_addresses || fallbackAddressSet(stored.luna_address));
        setScreen('locked');
      } else {
        setScreen('onboard');
      }
      return;
    }

    try { await apiRequest('/auth/me', {}, savedToken); } catch {
      await chrome.storage.local.remove(['luna_jwt', 'luna_email', 'luna_address', 'luna_addresses', 'luna_unlocked']);
      setToken(null); setEmail(null); setAddress(null); setAddresses(null); setScreen('onboard'); return;
    }

    const sessionStore = await chrome.storage.session.get('luna_session_private_key');
    const savedPk = sessionStore.luna_session_private_key || null;
    setSessionPrivateKey(savedPk);

    const savedAddress = stored.luna_address || null;
    const savedAddresses = stored.luna_addresses || (savedAddress ? fallbackAddressSet(savedAddress) : null);

    if (!savedAddress || !savedAddresses) { setScreen(localLogin ? 'locked' : 'onboard'); return; }
    setAddress(savedAddress); setAddresses(savedAddresses);

    if (stored.luna_unlocked && savedPk) {
      setScreen('wallet');
      await refreshBalance(savedToken, savedAddress, savedNetwork, savedAddresses);
    } else { setScreen(localLogin ? 'locked' : 'onboard'); }
  }

  useEffect(() => { void boot(); }, []);

  useEffect(() => {
    const listener = (msg: any) => {
      if (msg.type === 'LUNA_PENDING_CONNECTION') { setPending({ kind: 'connect', payload: msg.payload }); setScreen('connect_request'); }
      if (msg.type === 'LUNA_PENDING_TX') { setPending({ kind: 'tx', payload: msg.payload }); setScreen('tx_request'); }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  useEffect(() => {
    if (!sessionPrivateKey) return;
    let cancelled = false;
    const sync = async () => {
      try {
        const next = await deriveAddressesViaBackground(network, sessionPrivateKey);
        if (cancelled) return;
        if (addresses && addresses.shielded === next.shielded && addresses.unshielded === next.unshielded && addresses.dust === next.dust) return;
        setAddress(next.shielded); setAddresses(next);
        await writeStorage({ luna_address: next.shielded, luna_addresses: next, luna_network: network });
      } catch (e) { console.error('[Luna] sync failed:', e); }
    };
    void sync();
    return () => { cancelled = true; };
  }, [network, sessionPrivateKey]);

  // ── Auth flows ────────────────────────────────────────────────────────

  async function requestOtp() {
    setBusy(true); setStatusText('');
    try {
      await apiRequest('/auth/request-otp', { method: 'POST', body: JSON.stringify({ email: otpEmail }) });
      setScreen('onboard_otp'); setStatusText('OTP sent to your email');
    } catch (err: any) { setStatusText(presentError(err)); } finally { setBusy(false); }
  }

  async function verifyOtpAndRoute() {
    setBusy(true); setStatusText('');
    try {
      const result = await apiRequest<{ token: string; user: { email: string }; hasWallet: boolean }>('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ email: otpEmail, otp: otpCode }) });
      setToken(result.token); setEmail(result.user.email);
      await writeStorage({ luna_jwt: result.token, luna_email: result.user.email });
      if (result.hasWallet) {
        const localLogin = await readLocalLoginRecord();
        if (localLoginMatches(localLogin, result.user.email)) {
          setOtpEmail(result.user.email);
          setScreen('locked');
          setStatusText('Enter your wallet password to unlock.');
        } else {
          setScreen('existing_wallet');
          setStatusText('Upload your backup file and enter password.');
        }
      }
      else { setScreen('new_wallet'); }
    } catch (err: any) { setStatusText(presentError(err)); } finally { setBusy(false); }
  }

  async function createNewWallet() {
    if (!setupPassword || setupPassword.length < 6) { setStatusText('Password must be at least 6 characters'); return; }
    if (!backupPassInput || backupPassInput.length < 6) { setStatusText('Backup password must be at least 6 characters'); return; }
    if (setupPassword === backupPassInput) { setStatusText('Password and backup password must be different'); return; }
    setBusy(true); setStatusText('');
    try {
      const pk = randomPrivateKey();
      const str1 = await encryptKey(pk, setupPassword);
      const str2 = await encryptKey(pk, backupPassInput);
      const [s1_1, s1_2] = splitString(str1);
      const [s2_1, s2_2] = splitString(str2);

      await apiRequest('/wallet/store-shards', { method: 'POST', body: JSON.stringify({ str1_1: s1_1, str2_1: s2_1 }) }, token);
      await writeLocalLoginRecord(otpEmail, str1);

      const backup = JSON.stringify({ str1_2: s1_2, str2_2: s2_2, email: otpEmail, version: 2 }, null, 2);
      setBackupFileContent(backup);

      const nextAddrs = await ensureAddress(token!, network, pk);
      setSessionPrivateKey(pk); setAddress(nextAddrs.shielded); setAddresses(nextAddrs);
      await chrome.storage.session.set({ luna_session_private_key: pk });
      await writeStorage({ luna_address: nextAddrs.shielded, luna_addresses: nextAddrs, luna_network: network, luna_unlocked: true });

      setScreen('download_backup'); setBackupDownloaded(false);
    } catch (err: any) { setStatusText(presentError(err)); } finally { setBusy(false); }
  }

  async function loginExisting() {
    if (!uploadedBackup) { setStatusText('Upload your backup file'); return; }
    if (!setupPassword) { setStatusText('Enter your password'); return; }
    setBusy(true); setStatusText('');
    try {
      await apiRequest('/auth/request-otp', { method: 'POST', body: JSON.stringify({ email: otpEmail }) }, token);
      setScreen('existing_otp'); setStatusText('Enter OTP to fetch your wallet shards');
    } catch (err: any) { setStatusText(presentError(err)); } finally { setBusy(false); }
  }

  async function fetchShardsAndDecrypt() {
    setBusy(true); setStatusText('');
    try {
      const shards = await apiRequest<{ str1_1: string; str2_1: string }>('/wallet/get-shards', { method: 'POST', body: JSON.stringify({ otp: otpCode }) }, token);
      const fullStr = combineStrings(shards.str1_1, uploadedBackup!.str1_2);
      const pk = await decryptKey(fullStr, setupPassword);
      await writeLocalLoginRecord(otpEmail || email || uploadedBackup!.email, fullStr);
      setSessionPrivateKey(pk);
      await chrome.storage.session.set({ luna_session_private_key: pk });
      const nextAddrs = await ensureAddress(token!, network, pk);
      setAddress(nextAddrs.shielded); setAddresses(nextAddrs);
      await writeStorage({ luna_unlocked: true });
      setScreen('wallet'); setActiveTab('home');
      await refreshBalance(token!, nextAddrs.shielded, network, nextAddrs);
    } catch (err: any) { setStatusText(presentError(err)); } finally { setBusy(false); }
  }

  // Recover flow
  async function recoverRequestOtp() {
    setBusy(true); setStatusText('');
    try {
      await apiRequest('/auth/request-otp', { method: 'POST', body: JSON.stringify({ email: otpEmail }) });
      setScreen('recover_otp'); setStatusText('OTP sent');
    } catch (err: any) { setStatusText(presentError(err)); } finally { setBusy(false); }
  }

  async function recoverVerifyAndFetch() {
    if (!uploadedBackup) { setStatusText('Upload your backup file'); return; }
    if (!setupPassword) { setStatusText('Enter your password'); return; }
    setBusy(true); setStatusText('');
    try {
      if (!token) {
        const result = await apiRequest<{ token: string; user: { email: string } }>('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ email: otpEmail, otp: otpCode }) });
        setToken(result.token); setEmail(result.user.email);
        await writeStorage({ luna_jwt: result.token, luna_email: result.user.email });
        await apiRequest('/auth/request-otp', { method: 'POST', body: JSON.stringify({ email: otpEmail }) }, result.token);
        setOtpCode(''); setStatusText('Enter new OTP to fetch wallet shards');
        setBusy(false); return;
      }
      const shards = await apiRequest<{ str1_1: string; str2_1: string }>('/wallet/get-shards', { method: 'POST', body: JSON.stringify({ otp: otpCode }) }, token);
      const fullStr = combineStrings(shards.str1_1, uploadedBackup.str1_2);
      const pk = await decryptKey(fullStr, setupPassword);
      await writeLocalLoginRecord(otpEmail || email || uploadedBackup.email, fullStr);
      setSessionPrivateKey(pk);
      await chrome.storage.session.set({ luna_session_private_key: pk });
      const nextAddrs = await ensureAddress(token, network, pk);
      setAddress(nextAddrs.shielded); setAddresses(nextAddrs);
      await writeStorage({ luna_unlocked: true });
      setScreen('wallet'); setActiveTab('home');
      await refreshBalance(token, nextAddrs.shielded, network, nextAddrs);
    } catch (err: any) { setStatusText(presentError(err)); } finally { setBusy(false); }
  }

  // Forgot password flow
  async function forgotRequestOtp() {
    setBusy(true); setStatusText('');
    try {
      await apiRequest('/auth/request-otp', { method: 'POST', body: JSON.stringify({ email: otpEmail }) });
      setScreen('forgot_otp'); setStatusText('OTP sent');
    } catch (err: any) { setStatusText(presentError(err)); } finally { setBusy(false); }
  }

  async function forgotVerifyOtp() {
    setBusy(true); setStatusText('');
    try {
      const result = await apiRequest<{ token: string; user: { email: string } }>('/auth/verify-otp-existing', { method: 'POST', body: JSON.stringify({ email: otpEmail, otp: otpCode }) });
      setToken(result.token); setEmail(result.user.email);
      await writeStorage({ luna_jwt: result.token, luna_email: result.user.email });
      setScreen('forgot_unlock');
    } catch (err: any) { setStatusText(presentError(err)); } finally { setBusy(false); }
  }

  async function forgotResetPassword() {
    if (!uploadedBackup) { setStatusText('Upload backup file'); return; }
    if (!backupPassInput) { setStatusText('Enter backup password'); return; }
    if (!newPasswordInput || newPasswordInput.length < 6) { setStatusText('New password must be at least 6 characters'); return; }
    if (!token) { setStatusText('Session expired. Verify OTP again.'); return; }

    setBusy(true); setStatusText('');
    try {
      const result = await apiRequest<{ encryptedStr1: string; backupFileContent: string }>(
        '/wallet/reset-password',
        {
          method: 'POST',
          body: JSON.stringify({
            backupPass: backupPassInput,
            newPassword: newPasswordInput,
            str2_2: uploadedBackup.str2_2,
          }),
        },
        token
      );

      await writeLocalLoginRecord(otpEmail || email || uploadedBackup.email, result.encryptedStr1);
      setBackupFileContent(result.backupFileContent);
      setBackupDownloaded(false);
      setScreen('download_backup');
      setStatusText('Password reset complete. Download your updated backup file.');
    } catch (err: any) { setStatusText(presentError(err)); } finally { setBusy(false); }
  }

  // ── Wallet operations ─────────────────────────────────────────────────

  async function changeNetwork(nextNetwork: Network) {
    setNetwork(nextNetwork); await writeStorage({ luna_network: nextNetwork });
    if (!token || !sessionPrivateKey) return;
    try {
      const next = await ensureAddress(token, nextNetwork, sessionPrivateKey);
      setAddress(next.shielded); setAddresses(next);
      await refreshBalance(token, next.shielded, nextNetwork, next);
    } catch (err: any) { setStatusText(presentError(err)); }
  }

  async function generateDust() {
    if (!token || !address || !sessionPrivateKey) return;
    try {
      setStatusText('Preparing DUST registration...');
      const result = await chrome.runtime.sendMessage({ type: 'LUNA_GENERATE_DUST', payload: { dustAddress: (addresses || fallbackAddressSet(address)).dust } });
      if (!result?.success) throw new Error(result?.error || 'Failed');
      setStatusText(`DUST submitted: ${String(result.txHash).slice(0, 12)}...`);
      await refreshBalance(token, address, network, addresses);
    } catch (err: any) { setStatusText(presentError(err)); }
  }

  async function sendTransaction() {
    if (!token || !address || !sessionPrivateKey) return;
    setBusy(true); setStatusText('');
    try {
      const tx = await chrome.runtime.sendMessage({ type: 'LUNA_SEND_TRANSACTION', payload: { to: sendTo, amount: sendAmount, token: sendToken, memo: sendMemo } });
      if (!tx?.success) throw new Error(tx?.error || 'Failed');
      setStatusText(tx.txHash ? `Submitted: ${tx.txHash.slice(0, 12)}...` : 'Transaction submitted');
      setSendTo(''); setSendAmount(''); setSendMemo('');
      await refreshBalance(token, address, network, addresses);
      setActiveTab('home');
    } catch (err: any) { setStatusText(presentError(err)); } finally { setBusy(false); }
  }

  async function approveConnection() { if (!pending || pending.kind !== 'connect') return; await chrome.runtime.sendMessage({ type: 'LUNA_APPROVE_CONNECTION', payload: { id: (pending.payload as PendingConnectionPayload).id } }); setPending(null); setScreen('wallet'); }
  async function rejectConnection() { if (!pending || pending.kind !== 'connect') return; await chrome.runtime.sendMessage({ type: 'LUNA_REJECT_CONNECTION', payload: { id: (pending.payload as PendingConnectionPayload).id } }); setPending(null); setScreen('wallet'); }
  async function approveTx() { if (!pending || pending.kind !== 'tx') return; const r = await chrome.runtime.sendMessage({ type: 'LUNA_APPROVE_TX', payload: { id: (pending.payload as PendingTxPayload).id } }); setStatusText(r?.success ? 'Approved' : (r?.error || 'Failed')); setPending(null); setScreen('wallet'); }
  async function rejectTx() { if (!pending || pending.kind !== 'tx') return; await chrome.runtime.sendMessage({ type: 'LUNA_REJECT_TX', payload: { id: (pending.payload as PendingTxPayload).id } }); setPending(null); setScreen('wallet'); }

  async function lock() {
    setSessionPrivateKey(null);
    await chrome.storage.session.remove('luna_session_private_key');
    await writeStorage({ luna_unlocked: false });
    setScreen('locked');
  }

  async function logout() {
    await chrome.storage.local.remove(['luna_jwt', 'luna_email', 'luna_address', 'luna_addresses', 'luna_unlocked', 'luna_network', 'luna_local_login']);
    await chrome.storage.session.remove('luna_session_private_key');
    setToken(null); setSessionPrivateKey(null); setEmail(null); setAddress(null); setAddresses(null);
    setBalance('0'); setOtpCode(''); setOtpEmail(''); setSetupPassword(''); setUploadedBackup(null);
    setScreen('onboard');
  }

  async function unlockWithLocalPassword() {
    if (!setupPassword) { setStatusText('Enter your wallet password'); return; }

    setBusy(true);
    setStatusText('');
    try {
      const localLogin = await readLocalLoginRecord();
      const loginEmail = otpEmail || email || '';
      if (!localLogin || !localLoginMatches(localLogin, loginEmail)) {
        setStatusText('No local wallet found for this email. Use Recover Wallet.');
        setBusy(false);
        return;
      }

      const pk = await decryptKey(localLogin.encryptedPrivateKey, setupPassword);
      setSessionPrivateKey(pk);
      await chrome.storage.session.set({ luna_session_private_key: pk });

      const nextAddrs = await ensureAddress(token || '', network, pk);
      setAddress(nextAddrs.shielded);
      setAddresses(nextAddrs);
      await writeStorage({ luna_unlocked: true, luna_email: loginEmail || localLogin.email });

      setScreen('wallet');
      setActiveTab('home');
      await refreshBalance(token || '', nextAddrs.shielded, network, nextAddrs);
    } catch (err: any) {
      setStatusText('Invalid password. Try again.');
    } finally {
      setBusy(false);
    }
  }

  // ── Hidden file input ─────────────────────────────────────────────────
  const fileInput = <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileUpload} style={{ display: 'none' }} />;

  const navbar = (
    <div style={{ position: 'absolute', left: 10, right: 10, bottom: 10, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
      {(['home', 'send', 'receive', 'settings'] as Tab[]).map((tab) => (
        <button key={tab} onClick={() => setActiveTab(tab)} style={{ ...ui.button, padding: 8, borderRadius: 10, background: activeTab === tab ? 'rgba(103,232,249,0.22)' : 'rgba(15,23,42,0.85)', border: activeTab === tab ? '1px solid #67e8f9' : '1px solid rgba(148,163,184,0.35)', textTransform: 'capitalize', fontSize: 12 }}>{tab}</button>
      ))}
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div style={ui.shell}>
      {fileInput}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {stars.map((s) => (<span key={s.id} style={{ position: 'absolute', left: s.left, top: s.top, width: s.size, height: s.size, borderRadius: '50%', background: '#e2e8f0', opacity: s.opacity }} />))}
      </div>
      <div style={{ position: 'relative', zIndex: 1, padding: 12, paddingBottom: 78, minHeight: 560 }}>
        <div style={{ ...ui.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: '10px 12px' }}>
          <strong style={{ letterSpacing: '0.04em', fontWeight: 700 }}>Luna Wallet</strong>
          <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.95, border: '1px solid rgba(148,163,184,0.35)', borderRadius: 999, padding: '4px 8px', textTransform: 'uppercase' }}>{network}</span>
        </div>

        {screen === 'loading' && <p>Loading...</p>}

        {screen === 'onboard' && (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={ui.card}><p style={{ fontSize: 13, opacity: 0.95, lineHeight: 1.5 }}>Sign in with email OTP to create or access your wallet.</p></div>
            <input value={otpEmail} onChange={(e) => setOtpEmail(e.target.value)} placeholder="Email" style={ui.input} />
            <button disabled={busy || !otpEmail} onClick={() => void requestOtp()} style={ui.buttonPrimary}>{busy ? 'Sending...' : 'Send OTP'}</button>
            <button onClick={() => setScreen('recover')} style={ui.button}>Recover Wallet</button>
            <button onClick={() => setScreen('forgot')} style={ui.button}>Forgot Password</button>
          </div>
        )}

        {screen === 'onboard_otp' && (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={ui.card}><p style={{ fontSize: 13 }}>Enter the 6-digit code sent to <strong>{otpEmail}</strong></p></div>
            <input value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))} maxLength={6} placeholder="000000" style={{ ...ui.input, textAlign: 'center', fontSize: 20, letterSpacing: '0.3em' }} />
            <button disabled={busy || otpCode.length !== 6} onClick={() => void verifyOtpAndRoute()} style={ui.buttonPrimary}>{busy ? 'Verifying...' : 'Verify OTP'}</button>
          </div>
        )}

        {screen === 'new_wallet' && (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={ui.card}><p style={{ fontSize: 13, lineHeight: 1.5 }}>Set a <strong>password</strong> and a <strong>backup password</strong> to secure your wallet.</p></div>
            <input type="password" value={setupPassword} onChange={(e) => setSetupPassword(e.target.value)} placeholder="Password (min 6 chars)" style={ui.input} />
            <input type="password" value={backupPassInput} onChange={(e) => setBackupPassInput(e.target.value)} placeholder="Backup password (different)" style={ui.input} />
            <button disabled={busy} onClick={() => void createNewWallet()} style={ui.buttonPrimary}>{busy ? 'Creating...' : 'Create Wallet'}</button>
          </div>
        )}

        {screen === 'download_backup' && (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={ui.card}><p style={{ fontSize: 13, lineHeight: 1.5 }}>⚠️ <strong>Download your backup file</strong>. Without it, your wallet cannot be recovered on another device.</p></div>
            <button onClick={() => { if (backupFileContent) { downloadBackupFile(backupFileContent, otpEmail || email || ''); setBackupDownloaded(true); } }} style={ui.buttonPrimary}>{backupDownloaded ? '✓ Download Again' : 'Download Backup File'}</button>
            {backupDownloaded && <button onClick={() => { setScreen('wallet'); setActiveTab('home'); }} style={ui.button}>Continue to Wallet →</button>}
          </div>
        )}

        {screen === 'existing_wallet' && (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={ui.card}><p style={{ fontSize: 13, lineHeight: 1.5 }}>Welcome back! Upload your backup file and enter your password.</p></div>
            <button onClick={() => fileInputRef.current?.click()} style={ui.button}>{uploadedBackup ? `✓ ${uploadedBackup.email}` : '📁 Upload Backup File'}</button>
            <input type="password" value={setupPassword} onChange={(e) => setSetupPassword(e.target.value)} placeholder="Wallet password" style={ui.input} />
            <button disabled={busy || !uploadedBackup || !setupPassword} onClick={() => void loginExisting()} style={ui.buttonPrimary}>{busy ? 'Sending OTP...' : 'Unlock Wallet'}</button>
          </div>
        )}

        {screen === 'existing_otp' && (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={ui.card}><p style={{ fontSize: 13 }}>Enter OTP to fetch your wallet shards</p></div>
            <input value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))} maxLength={6} placeholder="000000" style={{ ...ui.input, textAlign: 'center', fontSize: 20, letterSpacing: '0.3em' }} />
            <button disabled={busy || otpCode.length !== 6} onClick={() => void fetchShardsAndDecrypt()} style={ui.buttonPrimary}>{busy ? 'Decrypting...' : 'Verify & Unlock'}</button>
          </div>
        )}

        {screen === 'recover' && (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={ui.card}><p style={{ fontSize: 13, lineHeight: 1.5 }}>Recover wallet on this device. You need your email, backup file, and password.</p></div>
            <input value={otpEmail} onChange={(e) => setOtpEmail(e.target.value)} placeholder="Email" style={ui.input} />
            <button onClick={() => fileInputRef.current?.click()} style={ui.button}>{uploadedBackup ? `✓ ${uploadedBackup.email}` : '📁 Upload Backup File'}</button>
            <input type="password" value={setupPassword} onChange={(e) => setSetupPassword(e.target.value)} placeholder="Wallet password" style={ui.input} />
            <button disabled={busy || !otpEmail || !uploadedBackup || !setupPassword} onClick={() => void recoverRequestOtp()} style={ui.buttonPrimary}>{busy ? 'Sending...' : 'Send OTP to Recover'}</button>
            <button onClick={() => setScreen('onboard')} style={ui.button}>Back</button>
          </div>
        )}

        {screen === 'recover_otp' && (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={ui.card}><p style={{ fontSize: 13 }}>Enter OTP to verify and recover your wallet</p></div>
            <input value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))} maxLength={6} placeholder="000000" style={{ ...ui.input, textAlign: 'center', fontSize: 20, letterSpacing: '0.3em' }} />
            <button disabled={busy || otpCode.length !== 6} onClick={() => void recoverVerifyAndFetch()} style={ui.buttonPrimary}>{busy ? 'Recovering...' : 'Verify & Recover'}</button>
          </div>
        )}

        {screen === 'forgot' && (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={ui.card}><p style={{ fontSize: 13, lineHeight: 1.5 }}>Reset your password using your <strong>backup password</strong> and backup file.</p></div>
            <input value={otpEmail} onChange={(e) => setOtpEmail(e.target.value)} placeholder="Email" style={ui.input} />
            <button disabled={busy || !otpEmail} onClick={() => void forgotRequestOtp()} style={ui.buttonPrimary}>{busy ? 'Sending...' : 'Send OTP'}</button>
            <button onClick={() => setScreen('onboard')} style={ui.button}>Back</button>
          </div>
        )}

        {screen === 'forgot_otp' && (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={ui.card}><p style={{ fontSize: 13 }}>Enter OTP to verify your identity</p></div>
            <input value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))} maxLength={6} placeholder="000000" style={{ ...ui.input, textAlign: 'center', fontSize: 20, letterSpacing: '0.3em' }} />
            <button disabled={busy || otpCode.length !== 6} onClick={() => void forgotVerifyOtp()} style={ui.buttonPrimary}>{busy ? 'Verifying...' : 'Verify'}</button>
          </div>
        )}

        {screen === 'forgot_unlock' && (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={ui.card}><p style={{ fontSize: 13, lineHeight: 1.5 }}>Upload backup file, enter your <strong>backup password</strong>, and set a new wallet password.</p></div>
            <button onClick={() => fileInputRef.current?.click()} style={ui.button}>{uploadedBackup ? `✓ ${uploadedBackup.email}` : '📁 Upload Backup File'}</button>
            <input type="password" value={backupPassInput} onChange={(e) => setBackupPassInput(e.target.value)} placeholder="Backup password" style={ui.input} />
            <input type="password" value={newPasswordInput} onChange={(e) => setNewPasswordInput(e.target.value)} placeholder="New password (min 6)" style={ui.input} />
            <button disabled={busy || !uploadedBackup} onClick={() => void forgotResetPassword()} style={ui.buttonPrimary}>{busy ? 'Processing...' : 'Reset Password'}</button>
          </div>
        )}

        {screen === 'locked' && (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={ui.card}><p style={{ fontSize: 13, opacity: 0.95 }}>Enter your wallet password to unlock this device.</p></div>
            <input type="email" value={otpEmail} onChange={(e) => setOtpEmail(e.target.value)} placeholder={email || 'Email'} style={ui.input} />
            <input type="password" value={setupPassword} onChange={(e) => setSetupPassword(e.target.value)} placeholder="Wallet password" style={ui.input} />
            <button disabled={busy || !setupPassword} onClick={() => void unlockWithLocalPassword()} style={ui.buttonPrimary}>{busy ? 'Unlocking...' : 'Unlock Wallet'}</button>
            <button onClick={() => setScreen('recover')} style={ui.button}>Use Recover Wallet</button>
            <button onClick={() => setScreen('forgot')} style={ui.button}>Forgot Password</button>
            <button onClick={() => void logout()} style={ui.button}>Sign In with OTP</button>
          </div>
        )}

        {screen === 'connect_request' && pending?.kind === 'connect' && (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={ui.card}>
              <div style={{ marginBottom: 6 }}>Connection request from</div>
              <div style={{ fontWeight: 700 }}>{(pending.payload as PendingConnectionPayload).name}</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>{(pending.payload as PendingConnectionPayload).origin}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button onClick={() => void rejectConnection()} style={ui.button}>Reject</button>
              <button onClick={() => void approveConnection()} style={ui.buttonPrimary}>Approve</button>
            </div>
          </div>
        )}

        {screen === 'tx_request' && pending?.kind === 'tx' && (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={ui.card}>
              <div style={{ marginBottom: 6 }}>Transaction request</div>
              <div>To: {shorten((pending.payload as PendingTxPayload).to)}</div>
              <div>Amount: {(pending.payload as PendingTxPayload).amount}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button onClick={() => void rejectTx()} style={ui.button}>Reject</button>
              <button onClick={() => void approveTx()} style={ui.buttonPrimary}>Approve</button>
            </div>
          </div>
        )}

        {screen === 'wallet' && (
          <>
            {activeTab === 'home' && (
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={ui.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>NIGHT Balance</div>
                    {isFetchingBalance && <div style={{ fontSize: 10, color: '#67e8f9' }}>fetching...</div>}
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 700 }}>{formatAmount(balance, 4)}</div>
                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8, display: 'flex', justifyContent: 'space-between' }}>
                    <span>DUST</span><span style={{ color: '#67e8f9' }}>{formatAmount(dustBalance, 2)}</span>
                  </div>
                  <div style={{ marginTop: 12, fontSize: 12, opacity: 0.8 }}>Shielded Address</div>
                  <div style={{ wordBreak: 'break-all', fontSize: 12 }}>{addresses?.shielded || address || '—'}</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button disabled={isFetchingBalance} onClick={() => token && address && void refreshBalance(token, address, network)} style={ui.button}>{isFetchingBalance ? 'Fetching...' : 'Refresh'}</button>
                  <button onClick={() => void generateDust()} style={ui.buttonPrimary}>Generate Dust</button>
                </div>
              </div>
            )}
            {activeTab === 'send' && (
              <div style={{ display: 'grid', gap: 10 }}>
                <input value={sendTo} onChange={(e) => setSendTo(e.target.value)} placeholder="Recipient address" style={ui.input} />
                <select value={sendToken} onChange={(e) => setSendToken(e.target.value as TokenKind)} style={ui.input}><option value="NIGHT">NIGHT</option></select>
                <input value={sendAmount} onChange={(e) => setSendAmount(e.target.value)} placeholder="Token amount" style={ui.input} />
                <input value={sendMemo} onChange={(e) => setSendMemo(e.target.value)} placeholder="Memo (optional)" style={ui.input} />
                <button disabled={busy || !sendTo || !sendAmount} onClick={() => void sendTransaction()} style={ui.buttonPrimary}>{busy ? 'Sending...' : 'Send'}</button>
              </div>
            )}
            {activeTab === 'receive' && (
              <div style={{ display: 'grid', gap: 10 }}>
                {[{ label: 'Shielded', value: addresses?.shielded || address || '' }, { label: 'Unshielded', value: addresses?.unshielded || '' }, { label: 'Dust', value: addresses?.dust || '' }].map((a) => (
                  <div key={a.label} style={{ ...ui.card, display: 'grid', gap: 8 }}>
                    <div style={{ fontSize: 12, opacity: 0.85 }}>{a.label}</div>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      {a.value ? <img src={qrSrc(a.value)} alt={`${a.label} QR`} width={120} height={120} style={{ borderRadius: 8, background: 'white' }} /> : <div style={{ width: 120, height: 120, borderRadius: 8, border: '1px dashed rgba(148,163,184,0.5)' }} />}
                    </div>
                    <div style={{ fontSize: 11, wordBreak: 'break-all' }}>{a.value || '—'}</div>
                    <button onClick={() => { if (a.value) void copyText(a.value).then(() => setStatusText(`${a.label} copied`)); }} style={ui.button}>Copy {a.label}</button>
                  </div>
                ))}
              </div>
            )}
            {activeTab === 'settings' && (
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={ui.card}><div style={{ fontSize: 12, opacity: 0.8 }}>Email</div><div>{email || '—'}</div></div>
                <div style={ui.card}>
                  <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>Network</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {NETWORKS.map((n) => (<button key={n} onClick={() => void changeNetwork(n)} style={{ ...ui.button, background: network === n ? 'rgba(103,232,249,0.22)' : ui.button.background, border: network === n ? '1px solid #67e8f9' : ui.button.border, fontSize: 12 }}>{n}</button>))}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button onClick={() => void lock()} style={ui.button}>Lock</button>
                  <button onClick={() => void logout()} style={ui.button}>Logout</button>
                </div>
              </div>
            )}
            {navbar}
          </>
        )}

        {statusText && <p style={{ marginTop: 12, fontSize: 12, color: '#67e8f9', lineHeight: 1.45 }}>{statusText}</p>}
      </div>
    </div>
  );
};

export default PopupApp;
