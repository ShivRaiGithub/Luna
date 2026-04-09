import React from 'react';
import { Link } from 'react-router-dom';
import StarField from '../components/StarField';
import LunaLogo from '../components/LunaLogo';

const NotFound: React.FC = () => {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--void)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <StarField />
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: 24 }}>
        <div style={{ marginBottom: 32 }}>
          <LunaLogo size={48} showText={false} />
        </div>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 'clamp(80px, 15vw, 160px)',
          color: 'transparent',
          WebkitTextStroke: '1px rgba(167,139,255,0.3)',
          lineHeight: 1,
          letterSpacing: '-0.04em',
          marginBottom: 24,
          userSelect: 'none',
        }}>
          404
        </div>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 'clamp(20px, 3vw, 28px)',
          color: 'var(--star)',
          marginBottom: 16,
          letterSpacing: '-0.01em',
        }}>
          Lost in deep space
        </h1>
        <p style={{ color: 'var(--text-dim)', fontSize: 16, marginBottom: 40, maxWidth: 340, margin: '0 auto 40px' }}>
          This page drifted out of orbit. Let's get you back to the Midnight network.
        </p>
        <Link to="/" style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 13,
          letterSpacing: '0.08em',
          color: 'var(--void)',
          background: 'linear-gradient(135deg, #c4b5fd, #a78bff)',
          padding: '13px 28px',
          borderRadius: 10,
          display: 'inline-block',
          boxShadow: '0 0 24px rgba(167,139,255,0.4)',
        }}>
          RETURN HOME
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
