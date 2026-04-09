import React, { useState, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import StarField from '../components/StarField';
import LunaLogo from '../components/LunaLogo';
import { useWalletStore } from '../store/walletStore';
import { authApi, walletApi, setToken } from '../utils/api';

type AuthStep =
  | 'form'           // email + send OTP
  | 'otp'            // enter OTP code
  | 'new_wallet'     // new user: enter password + backupPass
  | 'creating'       // wallet creation animation
  | 'download'       // force backup file download
  | 'existing_wallet'// returning user: upload backup + enter password
  | 'recover'        // recover on new device: email + OTP first
  | 'recover_otp'    // recover OTP verification
  | 'recover_unlock' // enter password + upload backup file
  | 'forgot'         // forgot password: email + OTP
  | 'forgot_otp'     // forgot password OTP
  | 'forgot_unlock'  // upload backup + enter backupPass + new password
  | 'forgot_creating'; // re-encrypting animation

interface BackupFile {
  str1_2: string;
  str2_2: string;
  email: string;
  version: number;
}

const AuthPage: React.FC = () => {
  const { mode } = useParams<{ mode: 'login' | 'signup' | 'recover' | 'forgot' }>();
  const navigate = useNavigate();
  const { createWalletSplit, recoverWallet, resetPassword, setSession } = useWalletStore();

  const [step, setStep] = useState<AuthStep>(() => {
    if (mode === 'recover') return 'recover';
    if (mode === 'forgot') return 'forgot';
    return 'form';
  });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [backupPass, setBackupPass] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newBackupPass, setNewBackupPass] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [backupFileContent, setBackupFileContent] = useState<string | null>(null);
  const [backupDownloaded, setBackupDownloaded] = useState(false);
  const [uploadedBackup, setUploadedBackup] = useState<BackupFile | null>(null);
  const [jwtToken, setJwtToken] = useState<string | null>(null);
  const [hasWallet, setHasWallet] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Signup: Send OTP ─────────────────────────────────────────────────────
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.requestOTP(email);
      setStep('otp');
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  // ── Signup: Verify OTP ───────────────────────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await authApi.verifyOTP(email, otp);
      await setToken(result.token);
      setJwtToken(result.token);

      if (result.hasWallet) {
        // Returning user — needs backup file + password
        setHasWallet(true);
        setStep('existing_wallet');
      } else {
        // New user — create wallet
        setStep('new_wallet');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify code');
    } finally {
      setLoading(false);
    }
  };

  // ── New Wallet: Create with split keys ───────────────────────────────────
  const handleCreateWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (!backupPass || backupPass.length < 6) {
      setError('Backup password must be at least 6 characters');
      return;
    }
    if (password === backupPass) {
      setError('Password and backup password must be different');
      return;
    }

    setError('');
    setLoading(true);
    setStep('creating');

    try {
      const result = await createWalletSplit(email, password, backupPass);

      // Store server-side shards
      await walletApi.storeShards((result as any).str1_1, (result as any).str2_1);

      setBackupFileContent(result.backupFileContent);
      setStep('download');
    } catch (err: any) {
      setError(err.message || 'Failed to create wallet');
      setStep('new_wallet');
    } finally {
      setLoading(false);
    }
  };

  // ── Download backup file ─────────────────────────────────────────────────
  const handleDownloadBackup = () => {
    if (!backupFileContent) return;
    const blob = new Blob([backupFileContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `luna-backup-${email.replace(/[^a-z0-9._-]/gi, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBackupDownloaded(true);
  };

  const handleProceedAfterDownload = () => {
    navigate('/app/wallet');
  };

  // ── Upload backup file ───────────────────────────────────────────────────
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string) as BackupFile;
        if (!parsed.str1_2 || !parsed.str2_2) {
          setError('Invalid backup file format');
          return;
        }
        setUploadedBackup(parsed);
        setError('');
      } catch {
        setError('Could not parse backup file');
      }
    };
    reader.readAsText(file);
  };

  // ── Existing Wallet: Login with backup + password ────────────────────────
  const handleExistingLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadedBackup) {
      setError('Please upload your backup file');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Need a fresh OTP to get shards from server
      await authApi.requestOTP(email);
      setStep('recover_otp');
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code');
      setLoading(false);
    }
  };

  // ── Recover: Step 1 — Enter email ────────────────────────────────────────
  const handleRecoverSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.requestOTP(email);
      setStep('recover_otp');
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  // ── Recover: Step 2 — Verify OTP, get shards, decrypt ───────────────────
  const handleRecoverVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // First verify OTP to get JWT
      if (!jwtToken) {
        const result = await authApi.verifyOTP(email, otp);
        await setToken(result.token);
        setJwtToken(result.token);
      }

      setStep('recover_unlock');
    } catch (err: any) {
      setError(err.message || 'Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  // ── Recover: Step 3 — Upload file + password → decrypt ──────────────────
  const handleRecoverUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadedBackup) {
      setError('Please upload your backup file');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Request OTP for shard retrieval
      await authApi.requestOTP(email);
      // We need another OTP to get shards
      setStep('recover_otp');
      // Store context that after OTP, we should fetch shards
      setHasWallet(true); // flag to indicate we need shards
    } catch (err: any) {
      setError(err.message || 'Failed');
      setLoading(false);
    }
  };

  // ── Actual shard fetch + decrypt (used by recover_otp and existing_wallet) ──
  const handleFetchShardsAndDecrypt = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // If we don't have a token yet, verify OTP to get one
      let currentToken = jwtToken;
      if (!currentToken) {
        const result = await authApi.verifyOTP(email, otp);
        await setToken(result.token);
        setJwtToken(result.token);
        currentToken = result.token;
        // Now request a NEW OTP for shard retrieval
        await authApi.requestOTP(email);
        setOtp('');
        setStep('recover_otp');
        setHasWallet(true);
        setLoading(false);
        return;
      }

      // We have a token, use this OTP to fetch shards
      const shards = await walletApi.getShards(otp);

      if (!uploadedBackup) {
        setError('Please upload your backup file');
        setLoading(false);
        return;
      }

      // Combine str1_1 (server) + str1_2 (file) and decrypt with password
      await recoverWallet(shards.str1_1, uploadedBackup.str1_2, password);
      await setSession(email, useWalletStore.getState().sessionPrivateKey!);
      navigate('/app/wallet');
    } catch (err: any) {
      setError(err.message || 'Failed to recover wallet. Check your password and backup file.');
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot Password: Step 1 — Enter email ───────────────────────────────
  const handleForgotSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.requestOTP(email);
      setStep('forgot_otp');
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot Password: Step 2 — Verify OTP ────────────────────────────────
  const handleForgotVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await authApi.verifyOTP(email, otp);
      await setToken(result.token);
      setJwtToken(result.token);
      setStep('forgot_unlock');
    } catch (err: any) {
      setError(err.message || 'Failed to verify');
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot Password: Step 3 — Upload backup, backupPass, new password ───
  const handleForgotReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadedBackup) {
      setError('Please upload your backup file');
      return;
    }
    if (!backupPass) {
      setError('Please enter your backup password');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }
    if (!newBackupPass || newBackupPass.length < 6) {
      setError('New backup password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');
    setStep('forgot_creating');

    try {
      // Request OTP for shard retrieval
      await authApi.requestOTP(email);
      // Need OTP to fetch shards
      setStep('forgot_otp');
      // We'll set a flag to know this is the second OTP (for shard fetch)
      setHasWallet(true);
      setLoading(false);
      return;
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
      setStep('forgot_unlock');
      setLoading(false);
    }
  };

  // ── Forgot: Fetch shards with OTP, decrypt with backupPass, re-encrypt ──
  const handleForgotFetchAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let currentToken = jwtToken;
      if (!currentToken) {
        const result = await authApi.verifyOTP(email, otp);
        await setToken(result.token);
        setJwtToken(result.token);
        currentToken = result.token;
        await authApi.requestOTP(email);
        setOtp('');
        setHasWallet(true);
        setLoading(false);
        return;
      }

      // Fetch shards with OTP
      const shards = await walletApi.getShards(otp);

      if (!uploadedBackup) {
        setError('Please upload your backup file');
        setLoading(false);
        return;
      }

      setStep('forgot_creating');

      // Decrypt with backup password, re-encrypt with new password
      const result = await resetPassword(
        shards.str2_1,
        uploadedBackup.str2_2,
        backupPass,
        newPassword,
        newBackupPass
      );

      // Request new OTP for updating shards
      await authApi.requestOTP(email);
      // We need another OTP round to update shards — but to simplify,
      // we use the same OTP verification pattern.
      // For now, update shards (server will require a new OTP)
      // Actually, let's request and wait for a new OTP
      setBackupFileContent(result.backupFileContent);

      // Store updated shards - need another OTP
      // For simplicity, we'll request OTP and then update
      setStep('forgot_otp');
      setOtp('');
      // Store the shard data to update after next OTP
      (window as any).__luna_pending_update = {
        newStr1_1: result.newStr1_1,
        newStr2_1: result.newStr2_1,
      };
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. Check your backup password and file.');
      setStep('forgot_unlock');
      setLoading(false);
    }
  };

  // ── Universal OTP handler based on context ──────────────────────────────
  const handleContextualOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const pendingUpdate = (window as any).__luna_pending_update;

      if (pendingUpdate) {
        // This is the forgot-password update-shards OTP
        await walletApi.updateShards(pendingUpdate.newStr1_1, pendingUpdate.newStr2_1, otp);
        delete (window as any).__luna_pending_update;

        // Show download screen for new backup
        setStep('download');
        setBackupDownloaded(false);
        setLoading(false);
        return;
      }

      if (step === 'recover_otp' && hasWallet && uploadedBackup) {
        // This is the recover shard-fetch OTP
        await handleFetchShardsAndDecrypt(e);
        return;
      }

      if (step === 'forgot_otp' && hasWallet && uploadedBackup && backupPass) {
        // This is the forgot shard-fetch OTP
        await handleForgotFetchAndReset(e);
        return;
      }

      // Default: initial OTP verification
      if (step === 'recover_otp') {
        await handleRecoverVerifyOtp(e);
      } else if (step === 'forgot_otp') {
        await handleForgotVerifyOtp(e);
      } else {
        await handleVerifyOtp(e);
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      padding: 24,
    }}>
      <StarField />

      <div style={{
        width: '100%',
        maxWidth: 420,
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 40 }}>
          <Link to="/">
            <LunaLogo size={40} showText={true} />
          </Link>
        </div>

        <div style={{
          border: '1px solid var(--border)',
          borderRadius: 20,
          padding: '40px 36px',
          background: 'rgba(10,10,26,0.85)',
          backdropFilter: 'blur(24px)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.5), 0 0 40px rgba(167,139,255,0.05)',
        }}>
          {/* ── Creating animation ────────────────────────────────────── */}
          {(step === 'creating' || step === 'forgot_creating') && (
            <CreatingWallet isForgot={step === 'forgot_creating'} />
          )}

          {/* ── Download backup ───────────────────────────────────────── */}
          {step === 'download' && (
            <DownloadStep
              onDownload={handleDownloadBackup}
              downloaded={backupDownloaded}
              onProceed={handleProceedAfterDownload}
            />
          )}

          {/* ── OTP Steps ─────────────────────────────────────────────── */}
          {(step === 'otp' || step === 'recover_otp' || step === 'forgot_otp') && (
            <OtpStep
              email={email}
              otp={otp}
              setOtp={setOtp}
              loading={loading}
              error={error}
              onSubmit={handleContextualOtp}
              subtitle={
                step === 'recover_otp' && hasWallet
                  ? 'Enter the verification code to access your wallet shards'
                  : step === 'forgot_otp' && hasWallet
                  ? 'Enter the verification code to proceed with password reset'
                  : undefined
              }
            />
          )}

          {/* ── New wallet creation ───────────────────────────────────── */}
          {step === 'new_wallet' && (
            <>
              <h2 style={headingStyle}>Set up your wallet</h2>
              <p style={subtitleStyle}>
                Create a password and a backup password to secure your wallet.
              </p>
              <form onSubmit={handleCreateWallet} style={formStyle}>
                <InputField
                  label="Password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  placeholder="Create a strong password"
                  required
                />
                <InputField
                  label="Backup Password"
                  type="password"
                  value={backupPass}
                  onChange={setBackupPass}
                  placeholder="Different password for recovery"
                  required
                />
                <p style={infoBoxStyle}>
                  🔐 <strong>Password</strong> encrypts your wallet for daily use.<br />
                  🔑 <strong>Backup Password</strong> lets you reset your main password if forgotten.<br />
                  ⚠️ Keep both passwords safe — they are never stored on our servers.
                </p>
                {error && <p style={errorStyle}>{error}</p>}
                <SubmitButton loading={loading} text="CREATE WALLET" loadingText="CREATING..." />
              </form>
            </>
          )}

          {/* ── Existing wallet login ─────────────────────────────────── */}
          {step === 'existing_wallet' && (
            <>
              <h2 style={headingStyle}>Welcome back</h2>
              <p style={subtitleStyle}>
                Upload your backup file and enter your password to access your wallet.
              </p>
              <form onSubmit={handleExistingLogin} style={formStyle}>
                <FileUploadField
                  label="Backup File"
                  onUpload={handleFileUpload}
                  fileName={uploadedBackup ? `✓ Backup loaded (${uploadedBackup.email})` : undefined}
                  fileInputRef={fileInputRef}
                />
                <InputField
                  label="Password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  placeholder="Enter your wallet password"
                  required
                />
                {error && <p style={errorStyle}>{error}</p>}
                <SubmitButton
                  loading={loading}
                  text="UNLOCK WALLET"
                  loadingText="SENDING OTP..."
                  disabled={!uploadedBackup}
                />
              </form>
            </>
          )}

          {/* ── Initial form (email entry) ────────────────────────────── */}
          {step === 'form' && (
            <>
              <h2 style={headingStyle}>
                {mode === 'login' ? 'Welcome back' : 'Create your wallet'}
              </h2>
              <p style={subtitleStyle}>
                {mode === 'login'
                  ? 'Sign in with your email to access your wallet.'
                  : 'Sign up with email — no seed phrase required.'}
              </p>
              <form onSubmit={handleSendOtp} style={formStyle}>
                <InputField
                  label="Email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="you@example.com"
                  required
                />
                {error && <p style={errorStyle}>{error}</p>}
                <SubmitButton loading={loading} text="SEND VERIFICATION CODE" loadingText="SENDING..." />
              </form>
              <div style={{ marginTop: 24, textAlign: 'center' }}>
                <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                  {mode === 'signup' ? 'Already have a wallet? ' : "Don't have a wallet? "}
                  <Link to={mode === 'signup' ? '/auth/login' : '/auth/signup'} style={linkStyle}>
                    {mode === 'signup' ? 'Sign in' : 'Create one'}
                  </Link>
                </p>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
                  <Link to="/auth/recover" style={linkStyle}>Recover wallet on this device</Link>
                  {' · '}
                  <Link to="/auth/forgot" style={linkStyle}>Forgot password?</Link>
                </p>
              </div>
            </>
          )}

          {/* ── Recover: Enter email ──────────────────────────────────── */}
          {step === 'recover' && (
            <>
              <h2 style={headingStyle}>Recover wallet</h2>
              <p style={subtitleStyle}>
                Enter your email to recover your wallet on this device. You'll need your backup file and password.
              </p>
              <form onSubmit={handleRecoverSendOtp} style={formStyle}>
                <InputField
                  label="Email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="you@example.com"
                  required
                />
                <FileUploadField
                  label="Backup File"
                  onUpload={handleFileUpload}
                  fileName={uploadedBackup ? `✓ Backup loaded (${uploadedBackup.email})` : undefined}
                  fileInputRef={fileInputRef}
                />
                <InputField
                  label="Password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  placeholder="Enter your wallet password"
                  required
                />
                {error && <p style={errorStyle}>{error}</p>}
                <SubmitButton loading={loading} text="SEND VERIFICATION CODE" loadingText="SENDING..." disabled={!uploadedBackup} />
              </form>
              <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-muted)' }}>
                <Link to="/auth/signup" style={linkStyle}>Back to signup</Link>
              </p>
            </>
          )}

          {/* ── Recover: Upload file + password (after OTP) ───────────── */}
          {step === 'recover_unlock' && (
            <>
              <h2 style={headingStyle}>Unlock your wallet</h2>
              <p style={subtitleStyle}>
                Upload your backup file and enter your password.
              </p>
              <form onSubmit={handleRecoverUnlock} style={formStyle}>
                <FileUploadField
                  label="Backup File"
                  onUpload={handleFileUpload}
                  fileName={uploadedBackup ? `✓ Backup loaded (${uploadedBackup.email})` : undefined}
                  fileInputRef={fileInputRef}
                />
                <InputField
                  label="Password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  placeholder="Enter your wallet password"
                  required
                />
                {error && <p style={errorStyle}>{error}</p>}
                <SubmitButton loading={loading} text="RECOVER WALLET" loadingText="RECOVERING..." disabled={!uploadedBackup} />
              </form>
            </>
          )}

          {/* ── Forgot Password: Enter email ─────────────────────────── */}
          {step === 'forgot' && (
            <>
              <h2 style={headingStyle}>Reset password</h2>
              <p style={subtitleStyle}>
                Enter your email. You'll need your backup file and <strong>backup password</strong>.
              </p>
              <form onSubmit={handleForgotSendOtp} style={formStyle}>
                <InputField
                  label="Email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="you@example.com"
                  required
                />
                {error && <p style={errorStyle}>{error}</p>}
                <SubmitButton loading={loading} text="SEND VERIFICATION CODE" loadingText="SENDING..." />
              </form>
              <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-muted)' }}>
                <Link to="/auth/login" style={linkStyle}>Back to login</Link>
              </p>
            </>
          )}

          {/* ── Forgot: Upload backup + backupPass + new passwords ───── */}
          {step === 'forgot_unlock' && (
            <>
              <h2 style={headingStyle}>Reset your password</h2>
              <p style={subtitleStyle}>
                Upload your backup file, enter your <strong>backup password</strong>, then set a new password.
              </p>
              <form onSubmit={handleForgotReset} style={formStyle}>
                <FileUploadField
                  label="Backup File"
                  onUpload={handleFileUpload}
                  fileName={uploadedBackup ? `✓ Backup loaded (${uploadedBackup.email})` : undefined}
                  fileInputRef={fileInputRef}
                />
                <InputField
                  label="Backup Password"
                  type="password"
                  value={backupPass}
                  onChange={setBackupPass}
                  placeholder="Enter your backup password"
                  required
                />
                <InputField
                  label="New Password"
                  type="password"
                  value={newPassword}
                  onChange={setNewPassword}
                  placeholder="Create a new password"
                  required
                />
                <InputField
                  label="New Backup Password"
                  type="password"
                  value={newBackupPass}
                  onChange={setNewBackupPass}
                  placeholder="Create a new backup password"
                  required
                />
                {error && <p style={errorStyle}>{error}</p>}
                <SubmitButton loading={loading} text="RESET PASSWORD" loadingText="RESETTING..." disabled={!uploadedBackup} />
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Styles ──────────────────────────────────────────────────────────────────

const headingStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  fontSize: 24,
  color: 'var(--star)',
  marginBottom: 6,
  letterSpacing: '-0.01em',
};

const subtitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 14,
  color: 'var(--text-dim)',
  marginBottom: 32,
  lineHeight: 1.6,
};

const formStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const errorStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--rose)',
  textAlign: 'center',
};

const linkStyle: React.CSSProperties = {
  color: 'var(--luna-bright)',
  fontWeight: 500,
};

const infoBoxStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-muted)',
  lineHeight: 1.6,
  padding: '10px 12px',
  border: '1px solid var(--border)',
  borderRadius: 8,
  background: 'rgba(167,139,255,0.03)',
};

// ── Sub-components ──────────────────────────────────────────────────────────

interface OtpStepProps {
  email: string;
  otp: string;
  setOtp: (v: string) => void;
  loading: boolean;
  error: string;
  onSubmit: (e: React.FormEvent) => void;
  subtitle?: string;
}

const OtpStep: React.FC<OtpStepProps> = ({ email, otp, setOtp, loading, error, onSubmit, subtitle }) => (
  <>
    <div style={{ textAlign: 'center', marginBottom: 28 }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>📬</div>
      <h2 style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: 22,
        color: 'var(--star)',
        marginBottom: 8,
      }}>
        Check your email
      </h2>
      <p style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.6 }}>
        {subtitle || (
          <>We sent a 6-digit code to<br />
          <strong style={{ color: 'var(--luna-bright)' }}>{email}</strong></>
        )}
      </p>
    </div>
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <input
        type="text"
        maxLength={6}
        value={otp}
        onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
        placeholder="000000"
        style={{
          width: '100%',
          padding: '16px',
          background: 'rgba(167,139,255,0.05)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          color: 'var(--star)',
          fontSize: 28,
          fontFamily: 'var(--font-mono)',
          textAlign: 'center',
          letterSpacing: '0.3em',
          outline: 'none',
        }}
      />
      {error && <p style={errorStyle}>{error}</p>}
      <SubmitButton loading={loading} text="VERIFY" loadingText="VERIFYING..." disabled={otp.length !== 6} />
    </form>
  </>
);

const DownloadStep: React.FC<{
  onDownload: () => void;
  downloaded: boolean;
  onProceed: () => void;
}> = ({ onDownload, downloaded, onProceed }) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: 48, marginBottom: 16 }}>📥</div>
    <h2 style={{
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 22,
      color: 'var(--star)',
      marginBottom: 12,
    }}>
      Download your backup file
    </h2>
    <p style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.7, marginBottom: 24 }}>
      This file is <strong style={{ color: 'var(--luna-bright)' }}>required</strong> to log in or recover your wallet.
      Store it somewhere safe — we cannot recover it for you.
    </p>
    <p style={infoBoxStyle}>
      ⚠️ <strong>Without this file, your wallet is permanently inaccessible</strong> on any new device.
      Save it to a secure location like a USB drive or password manager.
    </p>
    <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button
        onClick={onDownload}
        style={{
          width: '100%',
          padding: '14px',
          background: 'linear-gradient(135deg, #c4b5fd, #a78bff)',
          color: 'var(--void)',
          borderRadius: 10,
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 13,
          letterSpacing: '0.08em',
          cursor: 'pointer',
          boxShadow: '0 0 20px rgba(167,139,255,0.3)',
        }}
      >
        {downloaded ? '✓ DOWNLOADED — DOWNLOAD AGAIN' : 'DOWNLOAD BACKUP FILE'}
      </button>
      {downloaded && (
        <button
          onClick={onProceed}
          style={{
            width: '100%',
            padding: '14px',
            background: 'rgba(167,139,255,0.15)',
            color: 'var(--star)',
            borderRadius: 10,
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: '0.08em',
            cursor: 'pointer',
            border: '1px solid var(--border-bright)',
            transition: 'all 0.2s',
          }}
        >
          CONTINUE TO WALLET →
        </button>
      )}
    </div>
  </div>
);

const CreatingWallet: React.FC<{ isForgot?: boolean }> = ({ isForgot }) => {
  const [stage, setStage] = React.useState(0);
  const stages = isForgot
    ? [
        'Decrypting with backup password...',
        'Re-encrypting with new password...',
        'Splitting key shards...',
        'Ready ✓',
      ]
    : [
        'Generating keypair...',
        'Encrypting with your password...',
        'Encrypting with backup password...',
        'Splitting key shards...',
        'Storing server shards...',
        'Wallet ready ✓',
      ];

  React.useEffect(() => {
    const timers = stages.map((_, i) =>
      setTimeout(() => setStage(i), i * 700)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div style={{ textAlign: 'center', padding: '20px 0' }}>
      <div style={{
        width: 80,
        height: 80,
        borderRadius: '50%',
        border: '2px solid var(--border-bright)',
        borderTop: '2px solid var(--luna)',
        margin: '0 auto 28px',
        animation: 'spin 1s linear infinite',
      }} />
      <h2 style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: 20,
        color: 'var(--star)',
        marginBottom: 24,
      }}>
        {isForgot ? 'Resetting password' : 'Creating your wallet'}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}>
        {stages.map((s, i) => (
          <div key={i} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            opacity: i <= stage ? 1 : 0.3,
            transition: 'opacity 0.4s ease',
          }}>
            <span style={{ color: i < stage ? 'var(--green)' : i === stage ? 'var(--luna)' : 'var(--text-muted)', fontSize: 14 }}>
              {i < stage ? '✓' : i === stage ? '◉' : '○'}
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              color: i <= stage ? 'var(--text)' : 'var(--text-muted)',
            }}>
              {s}
            </span>
          </div>
        ))}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

// ── Reusable form components ────────────────────────────────────────────────

interface InputFieldProps {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  required?: boolean;
}

const InputField: React.FC<InputFieldProps> = ({ label, type, value, onChange, placeholder, required }) => {
  const [focused, setFocused] = React.useState(false);
  return (
    <div>
      <label style={{
        display: 'block',
        fontSize: 12,
        fontFamily: 'var(--font-mono)',
        letterSpacing: '0.08em',
        color: 'var(--text-dim)',
        marginBottom: 8,
      }}>
        {label.toUpperCase()}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%',
          padding: '12px 14px',
          background: 'rgba(167,139,255,0.05)',
          border: `1px solid ${focused ? 'var(--border-bright)' : 'var(--border)'}`,
          borderRadius: 10,
          color: 'var(--star)',
          fontSize: 15,
          outline: 'none',
          transition: 'border-color 0.2s, box-shadow 0.2s',
          boxShadow: focused ? '0 0 0 3px rgba(167,139,255,0.1)' : 'none',
        }}
      />
    </div>
  );
};

interface FileUploadFieldProps {
  label: string;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileName?: string;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

const FileUploadField: React.FC<FileUploadFieldProps> = ({ label, onUpload, fileName, fileInputRef }) => (
  <div>
    <label style={{
      display: 'block',
      fontSize: 12,
      fontFamily: 'var(--font-mono)',
      letterSpacing: '0.08em',
      color: 'var(--text-dim)',
      marginBottom: 8,
    }}>
      {label.toUpperCase()}
    </label>
    <div
      onClick={() => fileInputRef.current?.click()}
      style={{
        padding: '14px',
        background: 'rgba(167,139,255,0.05)',
        border: `1px dashed ${fileName ? 'var(--border-bright)' : 'var(--border)'}`,
        borderRadius: 10,
        color: fileName ? 'var(--luna-bright)' : 'var(--text-muted)',
        fontSize: 13,
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      {fileName || '📁 Click to upload backup file (.json)'}
    </div>
    <input
      ref={fileInputRef as any}
      type="file"
      accept=".json"
      onChange={onUpload}
      style={{ display: 'none' }}
    />
  </div>
);

const SubmitButton: React.FC<{
  loading: boolean;
  text: string;
  loadingText?: string;
  disabled?: boolean;
}> = ({ loading, text, loadingText, disabled }) => (
  <button
    type="submit"
    disabled={loading || disabled}
    style={{
      width: '100%',
      padding: '14px',
      background: (loading || disabled) ? 'rgba(167,139,255,0.3)' : 'linear-gradient(135deg, #c4b5fd, #a78bff)',
      color: (loading || disabled) ? 'rgba(255,255,255,0.5)' : 'var(--void)',
      borderRadius: 10,
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 13,
      letterSpacing: '0.08em',
      cursor: (loading || disabled) ? 'not-allowed' : 'pointer',
      transition: 'all 0.2s',
      marginTop: 8,
      boxShadow: (loading || disabled) ? 'none' : '0 0 20px rgba(167,139,255,0.3)',
    }}
  >
    {loading ? (loadingText || 'LOADING...') : text}
  </button>
);

export default AuthPage;
