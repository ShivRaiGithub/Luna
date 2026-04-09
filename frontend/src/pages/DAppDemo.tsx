import React, { useState } from 'react';
import StarField from '../components/StarField';
import Navbar from '../components/Navbar';
import { useWalletStore } from '../store/walletStore';

const DAppDemo: React.FC = () => {
  const currentAddress = useWalletStore(s => s.currentAddress);
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState('');
  const [step, setStep] = useState<'idle' | 'connecting' | 'connected' | 'approving' | 'done'>('idle');
  const [txHash, setTxHash] = useState('');

  const connect = async () => {
    setStep('connecting');
    await new Promise(r => setTimeout(r, 1200));
    if (!currentAddress) {
      setStep('idle');
      return;
    }
    setAddress(currentAddress);
    setConnected(true);
    setStep('connected');
  };

  const sendTx = async () => {
    setStep('approving');
    await new Promise(r => setTimeout(r, 2000));
    const hash = '0x' + Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('');
    setTxHash(hash);
    setStep('done');
  };

  const reset = () => {
    setConnected(false);
    setAddress('');
    setStep('idle');
    setTxHash('');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--void)', position: 'relative' }}>
      <StarField />
      <Navbar />
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 800, margin: '0 auto', padding: '120px 24px 80px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 60 }}>
          <span style={{
            display: 'inline-block',
            padding: '4px 12px',
            borderRadius: 100,
            border: '1px solid var(--border-bright)',
            background: 'rgba(103,232,249,0.06)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--cyan)',
            letterSpacing: '0.1em',
            marginBottom: 20,
          }}>
            LIVE DEMO
          </span>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 'clamp(32px, 5vw, 52px)',
            color: 'var(--star)',
            letterSpacing: '-0.02em',
            marginBottom: 16,
          }}>
            Midnight DEX
          </h1>
          <p style={{ color: 'var(--text-dim)', fontSize: 16 }}>
            A sample dApp showing how Luna integrates — just like MetaMask on Ethereum.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

          {/* dApp interface */}
          <div style={{
            border: '1px solid var(--border)',
            borderRadius: 20,
            overflow: 'hidden',
            background: 'rgba(10,10,26,0.7)',
            backdropFilter: 'blur(20px)',
          }}>
            {/* Mock DEX header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(167,139,255,0.04)',
            }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--star)' }}>
                🌑 MidnightDEX
              </span>
              {connected ? (
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--green)',
                  border: '1px solid rgba(74,222,128,0.3)',
                  padding: '3px 8px',
                  borderRadius: 100,
                  background: 'rgba(74,222,128,0.06)',
                }}>
                  ● {address.slice(0, 6)}...{address.slice(-4)}
                </span>
              ) : (
                <button
                  onClick={connect}
                  disabled={step === 'connecting' || !currentAddress}
                  style={{
                    padding: '6px 14px',
                    background: 'linear-gradient(135deg, #c4b5fd, #a78bff)',
                    color: '#030308',
                    borderRadius: 8,
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 11,
                    letterSpacing: '0.06em',
                    cursor: (step === 'connecting' || !currentAddress) ? 'not-allowed' : 'pointer',
                    opacity: (step === 'connecting' || !currentAddress) ? 0.7 : 1,
                  }}
                >
                  {!currentAddress ? 'CREATE WALLET FIRST' : step === 'connecting' ? 'CONNECTING...' : 'CONNECT WALLET'}
                </button>
              )}
            </div>

            {/* Swap UI */}
            <div style={{ padding: 20 }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 12 }}>
                SWAP TOKENS
              </p>

              {/* From */}
              <div style={{
                padding: '14px 16px',
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'rgba(167,139,255,0.03)',
                marginBottom: 8,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>You pay</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                    Balance: {connected ? '47.2350' : '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 24, color: 'var(--star)', fontWeight: 700 }}>5.00</span>
                  <span style={{
                    padding: '5px 10px',
                    borderRadius: 8,
                    background: 'rgba(167,139,255,0.1)',
                    border: '1px solid var(--border)',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 13,
                    color: 'var(--luna-bright)',
                  }}>NIGHT</span>
                </div>
              </div>

              {/* Swap arrow */}
              <div style={{ textAlign: 'center', fontSize: 18, color: 'var(--text-muted)', margin: '4px 0' }}>⇅</div>

              {/* To */}
              <div style={{
                padding: '14px 16px',
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'rgba(103,232,249,0.03)',
                marginBottom: 16,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>You receive</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--cyan)', opacity: 0.6 }}>~rate 1:200</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 24, color: 'var(--star)', fontWeight: 700 }}>1000.00</span>
                  <span style={{
                    padding: '5px 10px',
                    borderRadius: 8,
                    background: 'rgba(103,232,249,0.1)',
                    border: '1px solid rgba(103,232,249,0.2)',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 13,
                    color: 'var(--cyan)',
                  }}>DUST</span>
                </div>
              </div>

              {/* ZK notice */}
              <div style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid rgba(103,232,249,0.15)',
                background: 'rgba(103,232,249,0.04)',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--cyan)',
                marginBottom: 14,
                letterSpacing: '0.04em',
              }}>
                🔐 Trade is ZK-private — no on-chain amount exposure
              </div>

              <button
                onClick={connected ? sendTx : connect}
                disabled={step === 'connecting' || step === 'approving' || (!connected && !currentAddress)}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: !connected
                    ? 'rgba(167,139,255,0.15)'
                    : step === 'approving'
                    ? 'rgba(167,139,255,0.4)'
                    : step === 'done'
                    ? 'rgba(74,222,128,0.2)'
                    : 'linear-gradient(135deg, #c4b5fd, #a78bff)',
                  color: !connected ? 'var(--text-muted)' : step === 'done' ? 'var(--green)' : '#030308',
                  border: step === 'done' ? '1px solid rgba(74,222,128,0.3)' : 'none',
                  borderRadius: 12,
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: 13,
                  letterSpacing: '0.08em',
                  cursor: (step === 'approving' || step === 'connecting' || (!connected && !currentAddress)) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                }}
              >
                {!connected ? (currentAddress ? 'CONNECT TO SWAP' : 'CREATE WALLET TO CONNECT')
                  : step === 'approving' ? 'WAITING FOR APPROVAL...'
                  : step === 'done' ? '✓ SWAP COMPLETE'
                  : 'SWAP NOW'}
              </button>

              {step === 'done' && (
                <button onClick={reset} style={{
                  width: '100%',
                  marginTop: 8,
                  padding: '10px',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  letterSpacing: '0.06em',
                  cursor: 'pointer',
                }}>
                  RESET DEMO
                </button>
              )}
            </div>
          </div>

          {/* Luna flow visualization */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.1em',
              color: 'var(--text-muted)',
              marginBottom: 4,
            }}>
              LUNA INTEGRATION FLOW
            </p>

            {[
              {
                num: '01',
                label: 'dApp calls window.luna',
                code: "await window.luna.connect()",
                active: step !== 'idle',
                done: step !== 'idle',
                color: 'var(--luna)',
              },
              {
                num: '02',
                label: 'Luna popup opens',
                code: "// User sees connect request",
                active: step === 'connecting',
                done: ['connected','approving','done'].includes(step),
                color: 'var(--luna-bright)',
              },
              {
                num: '03',
                label: 'User approves connection',
                code: "// { address: 'mn1...' }",
                active: false,
                done: ['connected','approving','done'].includes(step),
                color: 'var(--cyan)',
              },
              {
                num: '04',
                label: 'dApp requests transaction',
                code: "await window.luna.signAndSubmit({...})",
                active: step === 'approving',
                done: step === 'done',
                color: 'var(--luna)',
              },
              {
                num: '05',
                label: 'ZK proof generated',
                code: "// midnight_generateProof()",
                active: step === 'approving',
                done: step === 'done',
                color: 'var(--cyan)',
              },
              {
                num: '06',
                label: 'Transaction broadcast',
                code: "// { txHash: '0x...' }",
                active: false,
                done: step === 'done',
                color: 'var(--green)',
              },
            ].map((s, i) => (
              <div key={i} style={{
                padding: '14px 16px',
                borderRadius: 12,
                border: `1px solid ${s.done ? s.color : s.active ? 'var(--border-bright)' : 'var(--border)'}`,
                background: s.done
                  ? `${s.color}10`
                  : s.active
                  ? 'rgba(167,139,255,0.06)'
                  : 'rgba(167,139,255,0.01)',
                transition: 'all 0.4s ease',
                opacity: s.active || s.done ? 1 : 0.45,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    color: s.done ? s.color : 'var(--text-muted)',
                    fontWeight: 700,
                    marginTop: 1,
                    minWidth: 22,
                    transition: 'color 0.3s',
                  }}>
                    {s.done ? '✓' : s.num}
                  </span>
                  <div style={{ flex: 1 }}>
                    <p style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 13,
                      color: s.done ? 'var(--star)' : 'var(--text-dim)',
                      marginBottom: 5,
                      fontWeight: s.done ? 500 : 400,
                      transition: 'color 0.3s',
                    }}>
                      {s.label}
                    </p>
                    <code style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      color: s.done ? s.color : 'var(--text-muted)',
                      letterSpacing: '0.03em',
                      transition: 'color 0.3s',
                    }}>
                      {s.code}
                    </code>
                  </div>
                </div>
              </div>
            ))}

            {txHash && (
              <div style={{
                padding: '12px 14px',
                borderRadius: 10,
                border: '1px solid rgba(74,222,128,0.3)',
                background: 'rgba(74,222,128,0.05)',
                animation: 'fadeUp 0.4s ease both',
              }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--green)', marginBottom: 4, letterSpacing: '0.08em' }}>
                  TX HASH
                </p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)', wordBreak: 'break-all', lineHeight: 1.6 }}>
                  {txHash}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Code snippet */}
        <div style={{ marginTop: 48 }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 16 }}>
            — INTEGRATE IN YOUR dAPP —
          </p>
          <div style={{
            borderRadius: 14,
            border: '1px solid var(--border)',
            background: 'rgba(6,6,15,0.95)',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '10px 16px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              {['#ff5f57','#febc2e','#28c840'].map((c,i) => (
                <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
              ))}
              <span style={{ marginLeft: 8, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                dapp-integration.js
              </span>
            </div>
            <pre style={{
              padding: '20px',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              lineHeight: 1.7,
              color: 'var(--text)',
              overflowX: 'auto',
              margin: 0,
            }}>
              <span style={{ color: 'var(--text-muted)' }}>{'// 1. Check if Luna is installed'}</span>{'\n'}
              <span style={{ color: 'var(--cyan)' }}>{'if'}</span>{' (window.luna?.isLuna) {\n'}
              {'  '}<span style={{ color: 'var(--text-muted)' }}>{'// 2. Connect wallet'}</span>{'\n'}
              {'  '}<span style={{ color: 'var(--cyan)' }}>{'const'}</span>{' { address } = '}<span style={{ color: 'var(--cyan)' }}>{'await'}</span>{' window.luna.'}<span style={{ color: 'var(--luna-bright)' }}>{'connect'}</span>{'();\n\n'}
              {'  '}<span style={{ color: 'var(--text-muted)' }}>{'// 3. Submit a private transaction'}</span>{'\n'}
              {'  '}<span style={{ color: 'var(--cyan)' }}>{'const'}</span>{' { txHash } = '}<span style={{ color: 'var(--cyan)' }}>{'await'}</span>{' window.luna.'}<span style={{ color: 'var(--luna-bright)' }}>{'signAndSubmit'}</span>{'({\n'}
              {'    '}<span style={{ color: 'var(--green)' }}>{'to'}</span>{': '}<span style={{ color: 'var(--rose)' }}>{`'mn1abc...'`}</span>{',\n'}
              {'    '}<span style={{ color: 'var(--green)' }}>{'amount'}</span>{': '}<span style={{ color: 'var(--rose)' }}>{`'5.0'`}</span>{',\n'}
              {'    '}<span style={{ color: 'var(--green)' }}>{'memo'}</span>{': '}<span style={{ color: 'var(--rose)' }}>{`'Swap NIGHT→DUST'`}</span>{'\n'}
              {'  });\n\n'}
              {'  '}<span style={{ color: 'var(--text-muted)' }}>{'// 4. Done — ZK-proven on Midnight'}</span>{'\n'}
              {'  console.'}<span style={{ color: 'var(--luna-bright)' }}>{'log'}</span>{'('}<span style={{ color: 'var(--rose)' }}>{`'txHash:'`}</span>{', txHash);\n'}
              {'}'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DAppDemo;
