import React from 'react';
import { useNetworkStatus } from '../hooks/useWallet';

interface NetworkStatusBarProps {
  network: string;
}

const NetworkStatusBar: React.FC<NetworkStatusBarProps> = ({ network }) => {
  const { latency, blockHeight, online } = useNetworkStatus(network);

  const latencyColor =
    latency === null ? 'var(--text-muted)' :
    latency < 50 ? 'var(--green)' :
    latency < 150 ? 'var(--luna)' : 'var(--rose)';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '6px 16px',
      borderTop: '1px solid var(--border)',
      background: 'rgba(6,6,15,0.6)',
      fontSize: 10,
      fontFamily: 'var(--font-mono)',
      letterSpacing: '0.06em',
    }}>
      <span style={{ color: 'var(--text-muted)' }}>
        BLOCK{' '}
        <span style={{ color: 'var(--text)' }}>
          #{blockHeight?.toLocaleString() ?? '—'}
        </span>
      </span>
      <span style={{ color: 'var(--text-muted)', flex: 1 }}>
        LATENCY{' '}
        <span style={{ color: latencyColor }}>
          {latency != null ? `${latency}ms` : '—'}
        </span>
      </span>
      <span style={{ color: 'var(--text-muted)' }}>
        <span style={{
          display: 'inline-block',
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: online ? 'var(--green)' : 'var(--rose)',
          marginRight: 5,
          animation: 'pulse 2s ease-in-out infinite',
        }} />
        {online ? 'LIVE' : 'OFFLINE'}
      </span>
      <style>{`
        @keyframes pulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
      `}</style>
    </div>
  );
};

export default NetworkStatusBar;
