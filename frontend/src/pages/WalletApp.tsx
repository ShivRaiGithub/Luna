import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import StarField from '../components/StarField';
import LunaLogo from '../components/LunaLogo';
import TxModal from '../components/TxModal';
import NetworkStatusBar from '../components/NetworkStatusBar';
import { useWalletStore } from '../store/walletStore';
import { shortenAddress, formatAmount } from '../utils/crypto';
import { useTransactions, useClipboard, Transaction } from '../hooks/useWallet';

const WalletApp: React.FC = () => {
  const navigate = useNavigate();
  const { isUnlocked, email, currentAddress, accounts, network, lockWallet, setNetwork, refreshBalance, addAccount, generateDust } = useWalletStore();
  const [tab, setTab] = useState<'wallet' | 'send' | 'receive' | 'settings'>('wallet');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const { copied, copy } = useClipboard();

  const currentAccount = accounts.find(a => a.address === currentAddress);

  useEffect(() => {
    if (!isUnlocked) navigate('/auth/login');
  }, [isUnlocked]);

  useEffect(() => {
    refreshBalance().catch(() => {});
  }, [network, currentAddress, refreshBalance]);

  const copyAddress = () => {
    if (currentAddress) copy(currentAddress);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--void)', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <StarField />

      {/* Top bar */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        padding: '0 20px',
        height: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border)',
        background: 'rgba(6,6,15,0.9)',
        backdropFilter: 'blur(20px)',
      }}>
        <LunaLogo size={28} showText={true} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <NetworkBadge network={network} setNetwork={setNetwork} />
          <button
            onClick={() => lockWallet()}
            title="Lock wallet"
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'rgba(167,139,255,0.05)',
              color: 'var(--text-dim)',
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            🔒
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{
        flex: 1,
        position: 'relative',
        zIndex: 1,
        maxWidth: 480,
        width: '100%',
        margin: '0 auto',
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}>
        {tab === 'wallet' && (
          <WalletTab
            account={currentAccount}
            address={currentAddress}
            onCopy={copyAddress}
            copied={copied}
            onSelectTx={setSelectedTx}
            onAction={(action) => {
              if (action === 'swap') {
                navigate('/demo');
                return;
              }
              setTab(action);
            }}
            onGenerateDust={generateDust}
          />
        )}
        {tab === 'send' && <SendTab onBack={() => setTab('wallet')} />}
        {tab === 'receive' && <ReceiveTab account={currentAccount} onBack={() => setTab('wallet')} />}
        {tab === 'settings' && <SettingsTab email={email} onBack={() => setTab('wallet')} />}
      </div>

      {/* Tx Detail Modal */}
      <TxModal tx={selectedTx} onClose={() => setSelectedTx(null)} />

      {/* Bottom nav */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        borderTop: '1px solid var(--border)',
        background: 'rgba(6,6,15,0.95)',
        backdropFilter: 'blur(20px)',
        display: 'flex',
        padding: '8px 0',
      }}>
        {([
          { id: 'wallet', icon: '◎', label: 'Wallet' },
          { id: 'send', icon: '↑', label: 'Send' },
          { id: 'receive', icon: '↓', label: 'Receive' },
          { id: 'settings', icon: '⊙', label: 'Settings' },
        ] as const).map(item => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: '8px 0',
              color: tab === item.id ? 'var(--luna-bright)' : 'var(--text-muted)',
              transition: 'color 0.2s',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 18 }}>{item.icon}</span>
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>{item.label}</span>
          </button>
        ))}
      </div>
      <NetworkStatusBar network={network} />
    </div>
  );
};

const WalletTab: React.FC<{
  account: any;
  address: string | null;
  onCopy: () => void;
  copied: boolean;
  onSelectTx: (tx: Transaction) => void;
  onAction: (action: 'send' | 'receive' | 'swap') => void;
  onGenerateDust: () => Promise<{ txHash: string; utxoCount: number; dustAddress: string }>;
}> = ({ account, address, onCopy, copied, onSelectTx, onAction, onGenerateDust }) => {
  const { refreshBalance, isFetchingBalance } = useWalletStore();
  const { transactions, loading: txLoading } = useTransactions(address);
  const [generatingDust, setGeneratingDust] = useState(false);
  const [dustError, setDustError] = useState('');
  const [dustInfo, setDustInfo] = useState('');

  const formatRelativeTime = (d: Date) => {
    const diff = Date.now() - d.getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hr ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  return (
    <>
      {/* Balance card */}
      <div style={{
        border: '1px solid var(--border-bright)',
        borderRadius: 20,
        padding: '28px 24px',
        background: 'linear-gradient(135deg, rgba(167,139,255,0.08), rgba(103,232,249,0.04))',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          top: -60,
          right: -60,
          width: 200,
          height: 200,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(167,139,255,0.1), transparent 70%)',
        }} />
        <p style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.12em',
          color: 'var(--text-muted)',
          marginBottom: 12,
        }}>
          {account?.name?.toUpperCase() || 'ACCOUNT 1'}
        </p>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 40,
          color: 'var(--star)',
          letterSpacing: '-0.02em',
          marginBottom: 4,
        }}>
          {formatAmount(account?.balance || '0', 4)}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--luna-bright)', marginBottom: 20 }}>
          NIGHT
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 10,
          alignItems: 'center',
          marginBottom: 14,
          flexWrap: 'wrap',
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
            DUST: <span style={{ color: 'var(--cyan)' }}>{formatAmount(account?.dustBalance || '0', 2)}</span>
          </span>
          <button
            onClick={async () => {
              setDustError('');
              setDustInfo('Preparing NIGHT UTXOs for DUST registration...');
              setGeneratingDust(true);
              try {
                const result = await onGenerateDust();
                setDustInfo(
                  `Submitted from ${result.utxoCount} NIGHT UTXO${result.utxoCount === 1 ? '' : 's'}: ${String(result.txHash).slice(0, 12)}... Wait for confirmation, then refresh balance.`
                );
              } catch (err: any) {
                setDustInfo('');
                setDustError(err?.message || 'Failed to generate DUST');
              } finally {
                setGeneratingDust(false);
              }
            }}
            disabled={generatingDust}
            style={{
              padding: '5px 10px',
              borderRadius: 999,
              border: '1px solid rgba(103,232,249,0.35)',
              background: 'rgba(103,232,249,0.08)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: generatingDust ? 'var(--text-muted)' : 'var(--cyan)',
              letterSpacing: '0.04em',
              cursor: generatingDust ? 'not-allowed' : 'pointer',
            }}
          >
            {generatingDust ? 'GENERATING...' : 'GENERATE DUST'}
          </button>
        </div>
        {dustError && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--rose)', marginBottom: 8 }}>
            {dustError}
          </div>
        )}
        {!dustError && dustInfo && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--cyan)', marginBottom: 8 }}>
            {dustInfo}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={onCopy}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'rgba(167,139,255,0.05)',
              color: copied ? 'var(--green)' : 'var(--text-dim)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.06em',
              cursor: 'pointer',
              transition: 'color 0.2s',
            }}
          >
            {copied ? '✓ COPIED' : (address ? shortenAddress(address, 10) : '—')}
          </button>
          
          <button
            onClick={() => refreshBalance().catch(() => {})}
            disabled={isFetchingBalance}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'rgba(103,232,249,0.05)',
              color: isFetchingBalance ? 'var(--text-muted)' : 'var(--cyan)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.06em',
              cursor: isFetchingBalance ? 'wait' : 'pointer',
              transition: 'color 0.2s',
            }}
          >
            {isFetchingBalance ? '↻ FETCHING...' : '↻ REFRESH'}
          </button>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {[
          { icon: '↑', label: 'Send', color: 'var(--luna)' },
          { icon: '↓', label: 'Receive', color: 'var(--cyan)' },
          { icon: '⇄', label: 'Swap', color: 'var(--rose)' },
        ].map(action => (
          <button key={action.label} style={{
            padding: '16px 8px',
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'rgba(167,139,255,0.03)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onClick={() => onAction(action.label.toLowerCase() as 'send' | 'receive' | 'swap')}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(167,139,255,0.08)';
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-bright)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(167,139,255,0.03)';
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
          }}
          >
            <span style={{ fontSize: 22, color: action.color }}>{action.icon}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.08em' }}>{action.label}</span>
          </button>
        ))}
      </div>

      {/* Transactions */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.12em',
            color: 'var(--text-muted)',
          }}>
            RECENT ACTIVITY
          </h3>
          {txLoading && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
              loading...
            </span>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {transactions.map((tx) => (
            <button
              key={tx.hash}
              onClick={() => onSelectTx(tx)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 16px',
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'rgba(167,139,255,0.02)',
                width: '100%',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(167,139,255,0.06)';
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-bright)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(167,139,255,0.02)';
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: tx.type === 'receive' ? 'rgba(74,222,128,0.1)' : 'rgba(251,113,133,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  color: tx.type === 'receive' ? 'var(--green)' : 'var(--rose)',
                }}>
                  {tx.type === 'receive' ? '↓' : '↑'}
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text)', marginBottom: 2 }}>
                    {tx.type === 'receive' ? 'Received' : 'Sent'}
                    {tx.isPrivate && (
                      <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--luna)', fontFamily: 'var(--font-mono)' }}>🔐</span>
                    )}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                    {formatRelativeTime(tx.timestamp)}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 14,
                  color: tx.type === 'receive' ? 'var(--green)' : 'var(--rose)',
                  marginBottom: 2,
                }}>
                  {tx.type === 'receive' ? '+' : '-'}{tx.amount}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>NIGHT</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
};

const SendTab: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { sendTransaction } = useWalletStore();
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [sending, setSending] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSending(true);
    try {
      const hash = await sendTransaction(to, amount);
      setTxHash(hash);
    } catch (err: any) {
      setError(err?.message || 'Transaction failed');
    }
    setSending(false);
  };

  if (txHash) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: 'var(--green)', marginBottom: 12 }}>
          Transaction Sent
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 8 }}>Transaction hash:</p>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--luna-bright)', wordBreak: 'break-all', marginBottom: 32 }}>
          {txHash.slice(0, 32)}...
        </p>
        <button onClick={onBack} style={{
          padding: '12px 28px',
          background: 'linear-gradient(135deg, #c4b5fd, #a78bff)',
          color: 'var(--void)',
          borderRadius: 10,
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 13,
          cursor: 'pointer',
        }}>
          BACK TO WALLET
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: 'var(--star)', marginBottom: 24 }}>
        Send NIGHT
      </h2>
      <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em', color: 'var(--text-dim)', marginBottom: 8 }}>
            RECIPIENT ADDRESS
          </label>
          <input
            value={to}
            onChange={e => setTo(e.target.value)}
            placeholder="mn1..."
            required
            style={{
              width: '100%',
              padding: '12px 14px',
              background: 'rgba(167,139,255,0.05)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              color: 'var(--star)',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              outline: 'none',
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em', color: 'var(--text-dim)', marginBottom: 8 }}>
            AMOUNT (NIGHT)
          </label>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.000000"
            required
            step="0.000001"
            style={{
              width: '100%',
              padding: '12px 14px',
              background: 'rgba(167,139,255,0.05)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              color: 'var(--star)',
              fontFamily: 'var(--font-mono)',
              fontSize: 16,
              outline: 'none',
            }}
          />
        </div>
        <button
          type="submit"
          disabled={sending}
          style={{
            padding: '14px',
            background: sending ? 'rgba(167,139,255,0.3)' : 'linear-gradient(135deg, #c4b5fd, #a78bff)',
            color: sending ? 'rgba(255,255,255,0.5)' : 'var(--void)',
            borderRadius: 10,
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: '0.08em',
            cursor: sending ? 'not-allowed' : 'pointer',
          }}
        >
          {sending ? 'BROADCASTING...' : 'SEND TRANSACTION'}
        </button>
        {error && (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--rose)' }}>
            {error}
          </p>
        )}
      </form>
    </div>
  );
};

const ReceiveTab: React.FC<{ account: any; onBack: () => void }> = ({ account }) => {
  const [copiedKey, setCopiedKey] = useState('');

  const rows: Array<{ kind: 'shielded' | 'unshielded' | 'dust'; label: string; address: string; accent: string }> = [
    { kind: 'shielded', label: 'Shielded', address: account?.address || '', accent: '#2042ff' },
    { kind: 'unshielded', label: 'Unshielded', address: account?.unshieldedAddress || '', accent: '#f59e0b' },
    { kind: 'dust', label: 'Dust', address: account?.dustAddress || '', accent: '#111111' },
  ];

  const copy = (key: string, value: string) => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2000);
  };

  return (
    <div style={{ textAlign: 'center' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: 'var(--star)', marginBottom: 8 }}>
        Receive Addresses
      </h2>
      <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 20 }}>Use the right address type for each transfer context.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'left' }}>
        {rows.map((row) => (
          <AddressCard
            key={row.kind}
            label={row.label}
            address={row.address}
            accent={row.accent}
            copied={copiedKey === row.kind}
            onCopy={() => copy(row.kind, row.address)}
          />
        ))}
      </div>
    </div>
  );
};

const AddressCard: React.FC<{
  label: string;
  address: string;
  accent: string;
  copied: boolean;
  onCopy: () => void;
}> = ({ label, address, accent, copied, onCopy }) => {
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    let mounted = true;
    if (!address) {
      setQrDataUrl('');
      return;
    }

    QRCode.toDataURL(address, { margin: 1, width: 190 })
      .then((url: string) => {
        if (mounted) setQrDataUrl(url);
      })
      .catch(() => {
        if (mounted) setQrDataUrl('');
      });

    return () => {
      mounted = false;
    };
  }, [address]);

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 16,
      padding: 14,
      background: 'rgba(167,139,255,0.03)',
      display: 'grid',
      gridTemplateColumns: '120px 1fr',
      gap: 14,
      alignItems: 'center',
    }}>
      <div style={{
        width: 120,
        height: 120,
        borderRadius: 12,
        border: `2px solid ${accent}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fff',
        overflow: 'hidden',
      }}>
        {qrDataUrl ? (
          <img src={qrDataUrl} alt={`${label} QR`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#666' }}>NO QR</span>
        )}
      </div>
      <div>
        <span style={{
          display: 'inline-block',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          padding: '3px 8px',
          borderRadius: 999,
          color: '#fff',
          background: accent,
          marginBottom: 8,
        }}>
          {label}
        </span>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)', wordBreak: 'break-all', marginBottom: 10 }}>
          {address || 'Not available'}
        </div>
        <button
          onClick={onCopy}
          disabled={!address}
          style={{
            padding: '7px 10px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: copied ? 'rgba(74,222,128,0.2)' : 'rgba(167,139,255,0.08)',
            color: copied ? 'var(--green)' : 'var(--text)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            cursor: address ? 'pointer' : 'not-allowed',
          }}
        >
          {copied ? '✓ COPIED' : 'COPY ADDRESS'}
        </button>
      </div>
    </div>
  );
};

const SettingsTab: React.FC<{ email: string | null; onBack: () => void }> = ({ email }) => {
  const { lockWallet, addAccount } = useWalletStore();
  const navigate = useNavigate();

  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: 'var(--star)', marginBottom: 24 }}>
        Settings
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <SettingRow icon="👤" label="Account" value={email || 'Unknown'} />
        <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
        <SettingRow
          icon="🔒"
          label="Lock Wallet"
          onClick={() => { lockWallet(); navigate('/auth/login'); }}
          danger
        />
      </div>
    </div>
  );
};

const SettingRow: React.FC<{
  icon: string;
  label: string;
  value?: string;
  onClick?: () => void;
  danger?: boolean;
}> = ({ icon, label, value, onClick, danger }) => (
  <button
    onClick={onClick}
    disabled={!onClick}
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '14px 16px',
      borderRadius: 12,
      border: '1px solid var(--border)',
      background: 'rgba(167,139,255,0.02)',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'all 0.2s',
      textAlign: 'left',
      width: '100%',
    }}
    onMouseEnter={e => {
      if (!onClick) return;
      (e.currentTarget as HTMLElement).style.background = 'rgba(167,139,255,0.06)';
      (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-bright)';
    }}
    onMouseLeave={e => {
      (e.currentTarget as HTMLElement).style.background = 'rgba(167,139,255,0.02)';
      (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
    }}
  >
    <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{
        fontFamily: 'var(--font-body)',
        fontSize: 15,
        color: danger ? 'var(--rose)' : 'var(--text)',
      }}>
        {label}
      </span>
    </span>
    {value && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>{value}</span>}
    {onClick && !value && <span style={{ color: 'var(--text-muted)', fontSize: 16 }}>›</span>}
  </button>
);

const NetworkBadge: React.FC<{
  network: string;
  setNetwork: (n: any) => void;
}> = ({ network, setNetwork }) => {
  const [open, setOpen] = useState(false);
  const colors: Record<string, string> = {
    mainnet: 'var(--green)',
    preprod: 'var(--luna)',
    preview: 'var(--cyan)',
    undeployed: 'var(--rose)',
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'rgba(167,139,255,0.05)',
          cursor: 'pointer',
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: colors[network], display: 'inline-block' }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.06em' }}>
          {network.toUpperCase()}
        </span>
      </button>
      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: 4,
          border: '1px solid var(--border)',
          borderRadius: 10,
          background: 'var(--surface)',
          overflow: 'hidden',
          zIndex: 10,
          minWidth: 140,
        }}>
          {(['mainnet', 'preprod', 'preview', 'undeployed'] as const).map(n => (
            <button
              key={n}
              onClick={() => { setNetwork(n); setOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                width: '100%',
                background: network === n ? 'rgba(167,139,255,0.1)' : 'transparent',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(167,139,255,0.08)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = network === n ? 'rgba(167,139,255,0.1)' : 'transparent'}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: colors[n], display: 'inline-block' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)', letterSpacing: '0.06em' }}>
                {n.toUpperCase()}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default WalletApp;
