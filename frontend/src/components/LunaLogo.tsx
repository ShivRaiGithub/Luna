import React from 'react';

interface LogoProps {
  size?: number;
  showText?: boolean;
}

const LunaLogo: React.FC<LogoProps> = ({ size = 36, showText = true }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="moonGrad" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#c4b5fd" />
            <stop offset="60%" stopColor="#a78bff" />
            <stop offset="100%" stopColor="#6d55cc" />
          </radialGradient>
          <radialGradient id="glowGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(167,139,255,0.4)" />
            <stop offset="100%" stopColor="rgba(167,139,255,0)" />
          </radialGradient>
        </defs>
        {/* Glow */}
        <circle cx="18" cy="18" r="18" fill="url(#glowGrad)" />
        {/* Moon crescent */}
        <circle cx="18" cy="18" r="13" fill="url(#moonGrad)" />
        <circle cx="24" cy="14" r="10" fill="#06060f" />
        {/* Stars */}
        <circle cx="8" cy="10" r="1.2" fill="#c4b5fd" opacity="0.9" />
        <circle cx="28" cy="26" r="0.8" fill="#c4b5fd" opacity="0.7" />
        <circle cx="6" cy="26" r="0.6" fill="#c4b5fd" opacity="0.5" />
      </svg>
      {showText && (
        <span style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: size * 0.6,
          letterSpacing: '0.06em',
          color: 'var(--star)',
          background: 'linear-gradient(135deg, #e8e4ff 0%, #a78bff 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          LUNA
        </span>
      )}
    </div>
  );
};

export default LunaLogo;
