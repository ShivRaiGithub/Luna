import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import walletRoutes from './routes/wallet';
import { errorHandler } from './middleware/auth';
import { requestLogger } from './middleware/logger';
import { connectDB } from './utils/db';

// Prefer local .env values to avoid empty inherited shell vars masking SMTP credentials.
dotenv.config({ override: true });

const app = express();
const PORT = parseInt(process.env.PORT || '3001');
const NODE_ENV = process.env.NODE_ENV || 'development';

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';

    // Allow server-to-server/no-origin requests and the configured web app origin.
    if (!origin || origin === allowedOrigin) {
      callback(null, true);
      return;
    }

    // Allow unpacked/installed extension pages to call the API.
    if (origin.startsWith('chrome-extension://')) {
      callback(null, true);
      return;
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please slow down.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  message: { success: false, error: 'Too many auth attempts.' },
});

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);
app.use(globalLimiter);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/auth', authLimiter, authRoutes);
app.use('/wallet', walletRoutes);

// ── Health ────────────────────────────────────────────────────────────────────
const startTime = Date.now();

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'Luna Wallet API',
    version: '2.0.0',
    network: 'Midnight',
    environment: NODE_ENV,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: ['/auth/request-otp', '/auth/verify-otp', '/auth/verify-otp-existing', '/auth/login', '/auth/me'],
      wallet: ['/wallet/store-shards', '/wallet/get-shards', '/wallet/update-shards', '/wallet/reset-password', '/wallet/check'],
    },
  });
});

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use(errorHandler);

// ── Boot ──────────────────────────────────────────────────────────────────────
async function boot() {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`
  ╔══════════════════════════════════════════╗
  ║          🌑  LUNA WALLET API             ║
  ║    Privacy-first on Midnight Network     ║
  ╠══════════════════════════════════════════╣
  ║  Port        : ${String(PORT).padEnd(24)}║
  ║  Environment : ${NODE_ENV.padEnd(24)}║
  ║  Auth        : JWT + OTP                 ║
  ║  Encryption  : AES-256-GCM (client)      ║
  ║  Database    : MongoDB (Mongoose)        ║
  ║  Network     : Midnight (preprod default)║
  ╚══════════════════════════════════════════╝
    `);
  });
}

boot().catch((err) => {
  console.error('[Luna] Failed to start:', err);
  process.exit(1);
});

export default app;
