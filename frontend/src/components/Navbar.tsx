import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import LunaLogo from './LunaLogo';

const Navbar: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isApp = location.pathname.startsWith('/app') || location.pathname.startsWith('/auth');

  return (
    <nav style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      padding: '0 40px',
      height: 68,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: scrolled ? 'rgba(3,3,8,0.85)' : 'transparent',
      backdropFilter: scrolled ? 'blur(20px)' : 'none',
      borderBottom: scrolled ? '1px solid var(--border)' : '1px solid transparent',
      transition: 'all 0.3s ease',
    }}>
      <Link to="/">
        <LunaLogo size={32} showText={true} />
      </Link>

      {!isApp && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          {['Features', 'Security',].map(item => (
            <a key={item} href={`#${item.toLowerCase()}`} style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--text-dim)',
              letterSpacing: '0.04em',
              transition: 'color 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--luna-bright)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
            >
              {item}
            </a>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        {isApp ? (
          <Link to="/" style={{
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            color: 'var(--text-dim)',
          }}>
            ← Back
          </Link>
        ) : (
          <>
            <Link to="/auth/login" style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--text-dim)',
              padding: '8px 16px',
              transition: 'color 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--star)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
            >
              Sign In
            </Link>
            <Link to="/auth/signup" style={{
              fontFamily: 'var(--font-display)',
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.06em',
              color: 'var(--void)',
              background: 'linear-gradient(135deg, #c4b5fd, #a78bff)',
              padding: '9px 20px',
              borderRadius: 8,
              transition: 'transform 0.2s, box-shadow 0.2s',
              boxShadow: '0 0 20px rgba(167,139,255,0.3)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 0 30px rgba(167,139,255,0.5)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 0 20px rgba(167,139,255,0.3)';
            }}
            >
              GET STARTED
            </Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
