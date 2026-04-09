import React from 'react';
import { Transaction } from '../hooks/useWallet';
import { shortenAddress } from '../utils/crypto';

interface TxModalProps {
  tx: Transaction | null;
  onClose: () => void;
}

const TxModal: React.FC<TxModalProps> = ({ tx, onClose }) => {
  if (!tx) return null;

  const isReceive = tx.type === 'receive';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(3,3,8,0.85)',
        backdropFilter: 'blur(12px)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 420,
          border: '1px solid var(--border-bright)',
          borderRadius: 20,
          background: 'var(--surface)',
          overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(0,0,0,0.6), 0 0 40px rgba(167,139,255,0.1)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: `${isReceive ? 'rgba(74,222,128,0.05)' : 'rgba(251,113,133,0.05)'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: isReceive ? 'rgba(74,222,128,0.12)' : 'rgba(251,113,133,0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              color: isReceive ? 'var(--green)' : 'var(--rose)',
            }}>
              {isReceive ? '↓' : '↑'}
            </div>
            <div>
              <p style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 16,
                color: 'var(--star)',
              }}>
                {isReceive ? 'Received' : 'Sent'}
              </p>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                {tx.status.toUpperCase()}
                {tx.isPrivate && <span style={{ color: 'var(--luna)', marginLeft: 8 }}>🔐 ZK</span>}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ color: 'var(--text-muted)', fontSize: 20, padding: 4, lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* Amount */}
        <div style={{ padding: '24px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 40,
            color: isReceive ? 'var(--green)' : 'var(--rose)',
            letterSpacing: '-0.02em',
          }}>
            {isReceive ? '+' : '−'}{tx.amount}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--luna)', marginTop: 4 }}>
            NIGHT
          </div>
        </div>

        {/* Details */}
        <div style={{ padding: '16px 24px' }}>
          {[
            ['Hash', shortenAddress(tx.hash, 12)],
            [isReceive ? 'From' : 'To', shortenAddress(tx.address, 12)],
            ['Block', tx.blockHeight?.toLocaleString() ?? '—'],
            ['Time', tx.timestamp.toLocaleString()],
            ['Privacy', tx.isPrivate ? 'ZK-shielded' : 'Transparent'],
          ].map(([label, value], i) => (
            <div key={i} style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '10px 0',
              borderBottom: i < 4 ? '1px solid rgba(120,100,255,0.08)' : 'none',
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                {label}
              </span>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: label === 'Privacy' && tx.isPrivate ? 'var(--luna)' : 'var(--text)',
              }}>
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* View on explorer */}
        <div style={{ padding: '12px 24px 20px' }}>
          <a
            href={`https://explorer.midnight.network/tx/${tx.hash}`}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'block',
              width: '100%',
              padding: '12px',
              textAlign: 'center',
              border: '1px solid var(--border)',
              borderRadius: 10,
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--luna-bright)',
              letterSpacing: '0.06em',
              background: 'rgba(167,139,255,0.04)',
              transition: 'all 0.2s',
            }}
          >
            VIEW ON EXPLORER ↗
          </a>
        </div>
      </div>
    </div>
  );
};

export default TxModal;
