import React from 'react';
import { Link } from 'react-router-dom';
import StarField from '../components/StarField';
import Navbar from '../components/Navbar';

const LandingPage: React.FC = () => {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--void)', position: 'relative' }}>
      <StarField />
      <Navbar />

      {/* Hero */}
      <section style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '120px 24px 80px',
        position: 'relative',
        zIndex: 1,
        textAlign: 'center',
      }}>
        {/* Glow circle behind */}
        <div style={{
          position: 'absolute',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(167,139,255,0.08) 0%, transparent 70%)',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }} />

        {/* Badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 14px 6px 8px',
          borderRadius: 100,
          border: '1px solid var(--border-bright)',
          background: 'rgba(167,139,255,0.06)',
          marginBottom: 40,
          animation: 'fadeUp 0.6s ease both',
        }}>
          <span style={{
            background: 'linear-gradient(135deg, #c4b5fd, #a78bff)',
            padding: '2px 8px',
            borderRadius: 100,
            fontSize: 10,
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: 'var(--void)',
          }}>NEW</span>
          <span style={{ fontSize: 13, color: 'var(--text-dim)', fontFamily: 'var(--font-body)' }}>
            Web2.5 wallet for Midnight
          </span>
        </div>

        {/* Headline */}
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 'clamp(42px, 7vw, 88px)',
          lineHeight: 1.05,
          letterSpacing: '-0.02em',
          color: 'var(--star)',
          maxWidth: 900,
          marginBottom: 24,
          animation: 'fadeUp 0.6s ease 0.1s both',
        }}>
          Secure self-custody<br />
          <span style={{
            background: 'linear-gradient(135deg, #c4b5fd 0%, #a78bff 40%, #67e8f9 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            No seed phrase panic
          </span>
        </h1>

        {/* Subhead */}
        <p style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 400,
          fontSize: 'clamp(16px, 2vw, 20px)',
          color: 'var(--text-dim)',
          maxWidth: 540,
          marginBottom: 48,
          lineHeight: 1.7,
          animation: 'fadeUp 0.6s ease 0.2s both',
        }}>
          Create your Midnight wallet account with just an email
        </p>

        {/* CTAs */}
        <div style={{
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
          justifyContent: 'center',
          animation: 'fadeUp 0.6s ease 0.3s both',
        }}>
          <Link to="/auth/signup" style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: '0.08em',
            color: 'var(--void)',
            background: 'linear-gradient(135deg, #c4b5fd, #a78bff)',
            padding: '14px 32px',
            borderRadius: 10,
            boxShadow: '0 0 30px rgba(167,139,255,0.4), 0 4px 20px rgba(0,0,0,0.3)',
            transition: 'all 0.25s ease',
            display: 'inline-block',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
            (e.currentTarget as HTMLElement).style.boxShadow = '0 0 50px rgba(167,139,255,0.6), 0 8px 30px rgba(0,0,0,0.4)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
            (e.currentTarget as HTMLElement).style.boxShadow = '0 0 30px rgba(167,139,255,0.4), 0 4px 20px rgba(0,0,0,0.3)';
          }}
          >
            CREATE WALLET FREE
          </Link>
          <a href="#features" style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 14,
            letterSpacing: '0.06em',
            color: 'var(--luna-bright)',
            border: '1px solid var(--border-bright)',
            padding: '14px 32px',
            borderRadius: 10,
            background: 'rgba(167,139,255,0.05)',
            transition: 'all 0.25s ease',
            display: 'inline-block',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(167,139,255,0.1)';
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--luna)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(167,139,255,0.05)';
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-bright)';
          }}
          >
            SEE HOW IT WORKS
          </a>
        </div>

        {/* Scroll hint */}
        <div style={{
          position: 'absolute',
          bottom: 40,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          opacity: 0.4,
          animation: 'fadeUp 1s ease 0.8s both',
        }}>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', color: 'var(--text-dim)' }}>SCROLL</span>
          <div style={{
            width: 1,
            height: 40,
            background: 'linear-gradient(to bottom, var(--luna-dim), transparent)',
          }} />
        </div>
      </section>

      {/* Features */}
      <section id="features" style={{
        padding: '120px 24px',
        position: 'relative',
        zIndex: 1,
        maxWidth: 1100,
        margin: '0 auto',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 80 }}>
          <p style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            letterSpacing: '0.14em',
            color: 'var(--luna)',
            marginBottom: 16,
          }}>
            — WHAT LUNA DOES —
          </p>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 'clamp(32px, 4vw, 52px)',
            color: 'var(--star)',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
          }}>
            Web2 simplicity.<br />Web3 ownership.
          </h2>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 20,
        }}>
          {[
            {
              icon: '📧',
              title: 'Email Login',
              desc: 'Create or access your wallet with email and password in a familiar Web2 flow.',
              accent: 'var(--luna)',
            },
            {
              icon: '💾',
              title: 'Downloadable Backup File',
              desc: 'Get a wallet backup file you can store in multiple safe places for long-term recovery.',
              accent: 'var(--cyan)',
            },
            {
              icon: '🛡️',
              title: 'Backup Leak Safe',
              desc: 'A leaked backup file alone is not enough to access funds or private keys.',
              accent: 'var(--luna-bright)',
            },
            {
              icon: '🔁',
              title: 'Password Reset + Recovery',
              desc: 'Forget password support is built in, with secure restore using the full recovery set.',
              accent: 'var(--rose)',
            },
            {
              icon: '📱',
              title: 'Restore On Any Device',
              desc: 'Recover with email + backup file + password and continue from where you left off.',
              accent: 'var(--green)',
            },
            {
              icon: '🌑',
              title: 'NIGHT Balance + Dust Tools',
              desc: 'View NIGHT balances and generate dust directly from Luna wallet controls.',
              accent: 'var(--cyan)',
            },
            {
              icon: '🌐',
              title: '4 Network Switching',
              desc: 'Quickly switch across four supported networks while keeping one consistent wallet UX.',
              accent: 'var(--luna)',
            },
            {
              icon: '📍',
              title: 'Address Toolkit',
              desc: 'View and copy shielded, unshielded, and dust addresses, plus generate QR for each.',
              accent: 'var(--rose)',
            },
            {
              icon: '💸',
              title: 'Send NIGHT Tokens',
              desc: 'Transfer NIGHT tokens with a streamlined send flow built for Midnight users.',
              accent: 'var(--green)',
            },
          ].map((f, i) => (
            <FeatureCard key={i} {...f} delay={i * 0.05} />
          ))}
        </div>
      </section>

      {/* Security section */}
      <section id="security" style={{
        padding: '100px 24px',
        position: 'relative',
        zIndex: 1,
        maxWidth: 900,
        margin: '0 auto',
      }}>
        <div style={{
          border: '1px solid var(--border)',
          borderRadius: 24,
          padding: '60px 48px',
          background: 'linear-gradient(135deg, rgba(167,139,255,0.04), rgba(103,232,249,0.02))',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute',
            top: -80,
            right: -80,
            width: 300,
            height: 300,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(167,139,255,0.08) 0%, transparent 70%)',
          }} />
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em', color: 'var(--luna)', marginBottom: 20 }}>
            — SECURITY MODEL —
          </p>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 'clamp(28px, 3.5vw, 44px)',
            color: 'var(--star)',
            marginBottom: 24,
            letterSpacing: '-0.02em',
          }}>
            Your keys. Your funds.<br />Always.
          </h2>
          <p style={{ color: 'var(--text-dim)', fontSize: 17, lineHeight: 1.8, maxWidth: 580, margin: '0 auto 40px' }}>
            Luna stays non-custodial end to end. Your key material remains protected, and wallet
            recovery requires the right combination of email, backup file, and password. One piece
            alone is not enough.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
            {['Email Login', 'Backup File Recovery', 'Forget Password Support', 'No Custodial Access'].map(tag => (
              <span key={tag} style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                letterSpacing: '0.06em',
                color: 'var(--luna-bright)',
                border: '1px solid var(--border-bright)',
                padding: '6px 14px',
                borderRadius: 100,
                background: 'rgba(167,139,255,0.05)',
              }}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section style={{
        padding: '80px 24px 120px',
        position: 'relative',
        zIndex: 1,
        maxWidth: 800,
        margin: '0 auto',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 60 }}>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 'clamp(28px, 3.5vw, 44px)',
            color: 'var(--star)',
            letterSpacing: '-0.02em',
          }}>
            Why Luna beats the rest
          </h2>
        </div>

        <div style={{
          border: '1px solid var(--border)',
          borderRadius: 20,
          overflow: 'hidden',
        }}>
          {/* Header row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 120px 120px',
            background: 'var(--surface)',
            padding: '16px 24px',
            borderBottom: '1px solid var(--border)',
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em', color: 'var(--text-muted)' }}>FEATURE</span>
            <span style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em', color: 'var(--text-muted)' }}>OTHERS</span>
            <span style={{ textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--luna-bright)' }}>LUNA</span>
          </div>
          {[
            ['Email login', false, true],
            ['Backup file based recovery', false, true],
            ['Forget/reset password flow', false, true],
            ['Restore on any device', '⚠️', true],
            ['4 network switching', '⚠️', true],
            ['Shielded/unshielded/dust addresses + QR', false, true],
            ['Send NIGHT tokens', true, true],
          ].map(([feature, others, luna], i) => (
            <div key={i} style={{
              display: 'grid',
              gridTemplateColumns: '1fr 120px 120px',
              padding: '14px 24px',
              borderBottom: i < 6 ? '1px solid rgba(120,100,255,0.07)' : 'none',
              background: i % 2 === 0 ? 'transparent' : 'rgba(167,139,255,0.02)',
            }}>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--text)' }}>{feature as string}</span>
              <span style={{ textAlign: 'center', fontSize: 16 }}>
                {others === true ? '✓' : others === false ? <span style={{ color: 'var(--text-muted)' }}>✗</span> : others}
              </span>
              <span style={{ textAlign: 'center', color: 'var(--green)', fontSize: 16 }}>
                {luna ? '✓' : '✗'}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Banner */}
      <section style={{
        padding: '80px 24px 140px',
        position: 'relative',
        zIndex: 1,
        textAlign: 'center',
      }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 'clamp(36px, 5vw, 64px)',
          color: 'var(--star)',
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
          marginBottom: 24,
        }}>
          Ready to explore<br />
          <span style={{
            background: 'linear-gradient(135deg, #c4b5fd 0%, #a78bff 50%, #67e8f9 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>Midnight network?</span>
        </h2>
        <p style={{ color: 'var(--text-dim)', fontSize: 18, marginBottom: 40 }}>
          Start with email, secure your backup, and use Midnight from one clean wallet experience.
        </p>
        <Link to="/auth/signup" style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 15,
          letterSpacing: '0.08em',
          color: 'var(--void)',
          background: 'linear-gradient(135deg, #c4b5fd, #a78bff)',
          padding: '16px 40px',
          borderRadius: 12,
          display: 'inline-block',
          boxShadow: '0 0 40px rgba(167,139,255,0.5), 0 8px 30px rgba(0,0,0,0.4)',
          transition: 'all 0.25s ease',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px) scale(1.02)';
          (e.currentTarget as HTMLElement).style.boxShadow = '0 0 60px rgba(167,139,255,0.7), 0 12px 40px rgba(0,0,0,0.5)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.transform = 'translateY(0) scale(1)';
          (e.currentTarget as HTMLElement).style.boxShadow = '0 0 40px rgba(167,139,255,0.5), 0 8px 30px rgba(0,0,0,0.4)';
        }}
        >
          LAUNCH LUNA — IT'S FREE
        </Link>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border)',
        padding: '40px 48px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 20,
        position: 'relative',
        zIndex: 1,
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
          © 2026 LUNA WALLET
        </span>

      </footer>
    </div>
  );
};

interface FeatureCardProps {
  icon: string;
  title: string;
  desc: string;
  accent: string;
  delay: number;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, desc, accent, delay }) => {
  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 16,
      padding: '28px',
      background: 'rgba(167,139,255,0.02)',
      position: 'relative',
      overflow: 'hidden',
      transition: 'all 0.3s ease',
      cursor: 'default',
    }}
    onMouseEnter={e => {
      const el = e.currentTarget as HTMLElement;
      el.style.borderColor = 'var(--border-bright)';
      el.style.background = 'rgba(167,139,255,0.05)';
      el.style.transform = 'translateY(-3px)';
      el.style.boxShadow = '0 16px 40px rgba(0,0,0,0.3), 0 0 20px rgba(167,139,255,0.1)';
    }}
    onMouseLeave={e => {
      const el = e.currentTarget as HTMLElement;
      el.style.borderColor = 'var(--border)';
      el.style.background = 'rgba(167,139,255,0.02)';
      el.style.transform = 'translateY(0)';
      el.style.boxShadow = 'none';
    }}
    >
      <div style={{
        width: 44,
        height: 44,
        borderRadius: 12,
        background: `rgba(167,139,255,0.1)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 22,
        marginBottom: 20,
        border: '1px solid var(--border)',
      }}>
        {icon}
      </div>
      <h3 style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: 17,
        color: 'var(--star)',
        marginBottom: 10,
        letterSpacing: '-0.01em',
      }}>
        {title}
      </h3>
      <p style={{
        fontFamily: 'var(--font-body)',
        fontSize: 14,
        color: 'var(--text-dim)',
        lineHeight: 1.7,
      }}>
        {desc}
      </p>
    </div>
  );
};

export default LandingPage;
