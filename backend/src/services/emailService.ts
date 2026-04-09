import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config({ override: true });

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value == null) return undefined;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
  return undefined;
}

const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
const smtpSecure = parseBoolean(process.env.SMTP_SECURE) ?? smtpPort === 465;
const smtpUser = process.env.SMTP_USER?.trim() || '';
const smtpPass = process.env.SMTP_PASS?.trim() || '';

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpSecure,
  auth: {
    user: smtpUser,
    pass: smtpPass,
  },
});

let smtpVerified = false;

async function ensureSMTPReady(): Promise<void> {
  if (!smtpUser || !smtpPass) {
    throw new Error('SMTP credentials are missing. Set SMTP_USER and SMTP_PASS in backend/.env');
  }

  if (smtpVerified) return;

  await transporter.verify();
  smtpVerified = true;
}

const LUNA_PURPLE = '#a78bff';
const LUNA_DARK = '#06060f';

function getEmailTemplate(title: string, body: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#030308;font-family:'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#030308;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#06060f;border:1px solid rgba(120,100,255,0.2);border-radius:20px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:32px;background:linear-gradient(135deg,rgba(167,139,255,0.1),rgba(103,232,249,0.05));border-bottom:1px solid rgba(120,100,255,0.15);text-align:center;">
              <div style="font-size:28px;margin-bottom:8px;">🌑</div>
              <div style="font-family:Georgia,serif;font-weight:700;font-size:24px;letter-spacing:0.1em;color:#e8e4ff;">LUNA</div>
              <div style="font-size:11px;letter-spacing:0.14em;color:#7a76a0;margin-top:4px;">MIDNIGHT WALLET</div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px 36px;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 36px;border-top:1px solid rgba(120,100,255,0.1);text-align:center;">
              <p style="font-size:12px;color:#4a4670;margin:0;">Luna Wallet — Privacy-first on Midnight Network</p>
              <p style="font-size:11px;color:#4a4670;margin:8px 0 0;">Never share your password or private key with anyone, including us.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendOTPEmail(email: string, otp: string): Promise<void> {
  await ensureSMTPReady();

  const body = `
    <h2 style="font-size:20px;font-weight:700;color:#e8e4ff;margin:0 0 12px;font-family:Georgia,serif;">Verify your email</h2>
    <p style="color:#7a76a0;font-size:15px;line-height:1.7;margin:0 0 28px;">
      Use the code below to verify your email and create your Luna wallet.
      This code expires in <strong style="color:#c4b5fd;">10 minutes</strong>.
    </p>
    <div style="text-align:center;margin:0 0 28px;">
      <div style="display:inline-block;padding:20px 40px;background:rgba(167,139,255,0.08);border:1px solid rgba(167,139,255,0.3);border-radius:14px;">
        <span style="font-family:'Courier New',monospace;font-size:38px;font-weight:700;letter-spacing:0.3em;color:#c4b5fd;">${otp}</span>
      </div>
    </div>
    <p style="color:#4a4670;font-size:13px;line-height:1.6;margin:0;">
      If you didn't request this, you can safely ignore this email.
      Your wallet will not be created without verification.
    </p>`;

  await transporter.sendMail({
    from: `"Luna Wallet" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `${otp} is your Luna verification code`,
    html: getEmailTemplate('Verify your Luna wallet', body),
  });
}

export async function sendWelcomeEmail(email: string): Promise<void> {
  await ensureSMTPReady();

  const body = `
    <h2 style="font-size:22px;font-weight:700;color:#e8e4ff;margin:0 0 12px;font-family:Georgia,serif;">
      Welcome to Luna ✨
    </h2>
    <p style="color:#7a76a0;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Your non-custodial Midnight wallet has been created successfully.
      You now have access to the full Midnight ecosystem — without seed phrases or ZK complexity.
    </p>
    <div style="background:rgba(167,139,255,0.05);border:1px solid rgba(167,139,255,0.15);border-radius:12px;padding:20px;margin:0 0 24px;">
      <p style="color:#c4b5fd;font-size:13px;font-weight:600;margin:0 0 8px;letter-spacing:0.06em;">🔐 SECURITY REMINDER</p>
      <p style="color:#7a76a0;font-size:13px;line-height:1.6;margin:0;">
        Your private key is encrypted locally on your device. Luna never has access to your keys or funds.
        Keep your password safe — it's the only way to decrypt your wallet.
      </p>
    </div>
    <p style="color:#4a4670;font-size:13px;">
      Start exploring Midnight dApps at <a href="https://midnight.network" style="color:#a78bff;">midnight.network</a>
    </p>`;

  await transporter.sendMail({
    from: `"Luna Wallet" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Welcome to Luna — Your Midnight wallet is ready',
    html: getEmailTemplate('Welcome to Luna', body),
  });
}

export async function sendBackupEmail(email: string, encryptedBackup: string): Promise<void> {
  await ensureSMTPReady();

  const body = `
    <h2 style="font-size:20px;font-weight:700;color:#e8e4ff;margin:0 0 12px;font-family:Georgia,serif;">
      Your encrypted wallet backup
    </h2>
    <p style="color:#7a76a0;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Your wallet backup has been encrypted with your password and is attached below.
      Store it somewhere safe — you'll need your password to restore it.
    </p>
    <div style="background:rgba(167,139,255,0.05);border:1px solid rgba(120,100,255,0.2);border-radius:10px;padding:16px;margin:0 0 24px;word-break:break-all;">
      <p style="font-family:'Courier New',monospace;font-size:11px;color:#7a76a0;margin:0;">${encryptedBackup.slice(0, 120)}...</p>
    </div>
    <p style="color:#4a4670;font-size:13px;line-height:1.6;">
      ⚠️ Never share this backup file or your password with anyone — including Luna support.
    </p>`;

  await transporter.sendMail({
    from: `"Luna Wallet" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Luna Wallet — Encrypted backup',
    html: getEmailTemplate('Wallet Backup', body),
  });
}
