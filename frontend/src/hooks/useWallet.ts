import { useState, useEffect, useCallback } from 'react';
import { useWalletStore } from '../store/walletStore';
import { authApi, setToken } from '../utils/api';
import { getBalance, getNetworkInfo, getNetworkStatuses, getTransactionHistory, type NetworkId } from '../utils/midnight';

export function useAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const requestOTP = useCallback(async (email: string) => {
    setLoading(true);
    setError('');
    try {
      await authApi.requestOTP(email);
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyOTP = useCallback(async (email: string, otp: string) => {
    setLoading(true);
    setError('');
    try {
      const result = await authApi.verifyOTP(email, otp);
      await setToken(result.token);
      return result;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, requestOTP, verifyOTP };
}

export function useBalance(address: string | null, network: string) {
  const [balance, setBalance] = useState('0');
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const result = await getBalance(network as NetworkId, address);
      setBalance(result.night || result.shielded?.night || result.unshielded?.night || '0');
    } catch {
      setBalance('0');
    } finally {
      setLoading(false);
    }
  }, [address, network]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { balance, loading, refresh };
}

export interface Transaction {
  hash: string;
  type: 'send' | 'receive';
  amount: string;
  address: string;
  timestamp: Date;
  status: 'confirmed' | 'pending' | 'failed';
  isPrivate: boolean;
  blockHeight?: number;
}

export function useTransactions(address: string | null) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const network = useWalletStore((state) => state.network);

  useEffect(() => {
    if (!address) return;

    let cancelled = false;

    const fetchTransactions = async () => {
      setLoading(true);
      try {
        const raw = await getTransactionHistory(network as NetworkId, address, 20);
        if (cancelled) return;

        const mapped: Transaction[] = raw.map((tx, idx) => ({
          hash: tx.hash || tx.txHash || `unknown_${idx}`,
          type: tx.type === 'receive' ? 'receive' : 'send',
          amount: String(tx.amount || '0'),
          address: tx.address || tx.to || tx.from || '',
          timestamp: tx.timestamp ? new Date(tx.timestamp) : new Date(),
          status: tx.status === 'pending' || tx.status === 'failed' ? tx.status : 'confirmed',
          isPrivate: tx.isPrivate !== false,
          blockHeight: tx.blockHeight,
        }));

        setTransactions(mapped);
      } catch {
        if (!cancelled) setTransactions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchTransactions();

    return () => {
      cancelled = true;
    };
  }, [address, network]);

  return { transactions, loading };
}

export function useClipboard(timeout = 2000) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), timeout);
    });
  }, [timeout]);

  return { copied, copy };
}

export function useNetworkStatus(network: string) {
  const [latency, setLatency] = useState<number | null>(null);
  const [blockHeight, setBlockHeight] = useState<number | null>(null);
  const [online, setOnline] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const update = async () => {
      try {
        const info = await getNetworkInfo(network as NetworkId);
        if (cancelled) return;

        setLatency(info.latencyMs);
        setBlockHeight(info.blockHeight ?? null);
        setOnline(true);
      } catch {
        try {
          const statuses = await getNetworkStatuses();
          if (cancelled) return;

          const status = statuses.find((entry) => entry.network === network);
          setLatency(status?.latencyMs ?? null);
          setBlockHeight(status?.blockHeight ?? null);
          setOnline(Boolean(status?.online));
        } catch {
          if (cancelled) return;
          setLatency(null);
          setBlockHeight(null);
          setOnline(false);
        }
      }
    };

    update();
    const interval = setInterval(update, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [network]);

  return { latency, blockHeight, online };
}
