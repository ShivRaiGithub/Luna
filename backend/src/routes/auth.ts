import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { UserModel } from '../models/User';
import { OTPModel } from '../models/OTP';
import { WalletShardModel } from '../models/WalletShard';
import { signToken, generateOTP, getOTPExpiry, isOTPExpired } from '../utils/auth';
import { sendOTPEmail, sendWelcomeEmail } from '../services/emailService';
import { ApiResponse } from '../utils/types';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /auth/request-otp — Send OTP to email
router.post(
  '/request-otp',
  [
    body('email').isEmail().normalizeEmail(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Invalid email address' } as ApiResponse);
    }

    const { email } = req.body as { email: string };

    try {
      const otp = generateOTP();
      const expiresAt = getOTPExpiry(10);

      // Invalidate any previous unused OTPs for this email
      await OTPModel.updateMany(
        { email: email.toLowerCase(), used: false },
        { used: true }
      );

      // Save new OTP to MongoDB
      await OTPModel.create({
        email: email.toLowerCase(),
        code: otp,
        expiresAt,
        used: false,
      });

      await sendOTPEmail(email, otp);
      console.log(`[Luna] OTP sent to ${email}`);

      return res.json({
        success: true,
        message: 'Verification code sent',
        ...(process.env.NODE_ENV === 'development' && { dev_otp: otp }),
      } as ApiResponse);
    } catch (err) {
      console.error('[Luna] OTP send error:', err);
      return res.status(500).json({ success: false, error: 'Failed to send verification code' } as ApiResponse);
    }
  }
);

// POST /auth/verify-otp — Verify OTP, create/find user, report wallet status
router.post(
  '/verify-otp',
  [
    body('email').isEmail().normalizeEmail(),
    body('otp').isLength({ min: 6, max: 6 }).isNumeric(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Invalid input' } as ApiResponse);
    }

    const { email, otp } = req.body as { email: string; otp: string };

    try {
      // Find the most recent unused OTP for this email
      const record = await OTPModel.findOne({
        email: email.toLowerCase(),
        used: false,
      }).sort({ createdAt: -1 });

      if (!record) {
        return res.status(400).json({ success: false, error: 'No verification code found for this email' } as ApiResponse);
      }

      if (isOTPExpired(record.expiresAt)) {
        return res.status(400).json({ success: false, error: 'Verification code expired' } as ApiResponse);
      }

      if (record.code !== otp) {
        return res.status(400).json({ success: false, error: 'Invalid verification code' } as ApiResponse);
      }

      // Remove all OTPs for this email after successful verification
      await OTPModel.deleteMany({ email: email.toLowerCase() });

      // Get or create user
      let user = await UserModel.findOne({ email: email.toLowerCase() });
      const isNewUser = !user;

      if (!user) {
        user = await UserModel.create({ email: email.toLowerCase() });

        // Send welcome email for new users
        try {
          await sendWelcomeEmail(email);
        } catch {
          // Non-critical
        }
      }

      // Check if wallet shards exist
      const walletShards = await WalletShardModel.findOne({ email: email.toLowerCase() });
      const hasWallet = !!walletShards;

      const token = signToken({ userId: user._id.toString(), email: user.email });

      return res.json({
        success: true,
        data: {
          token,
          user: { id: user._id.toString(), email: user.email },
          isNewUser,
          hasWallet,
        },
      } as ApiResponse);
    } catch (err) {
      console.error('[Luna] OTP verify error:', err);
      return res.status(500).json({ success: false, error: 'Failed to verify code' } as ApiResponse);
    }
  }
);

// POST /auth/verify-otp-existing — Verify OTP for existing users only (no auto-create)
router.post(
  '/verify-otp-existing',
  [
    body('email').isEmail().normalizeEmail(),
    body('otp').isLength({ min: 6, max: 6 }).isNumeric(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Invalid input' } as ApiResponse);
    }

    const { email, otp } = req.body as { email: string; otp: string };

    try {
      const record = await OTPModel.findOne({
        email: email.toLowerCase(),
        used: false,
      }).sort({ createdAt: -1 });

      if (!record) {
        return res.status(400).json({ success: false, error: 'No verification code found for this email' } as ApiResponse);
      }

      if (isOTPExpired(record.expiresAt)) {
        return res.status(400).json({ success: false, error: 'Verification code expired' } as ApiResponse);
      }

      if (record.code !== otp) {
        return res.status(400).json({ success: false, error: 'Invalid verification code' } as ApiResponse);
      }

      await OTPModel.deleteMany({ email: email.toLowerCase() });

      const user = await UserModel.findOne({ email: email.toLowerCase() });
      if (!user) {
        return res.status(404).json({ success: false, error: 'No account found for this email' } as ApiResponse);
      }

      const walletShards = await WalletShardModel.findOne({ email: email.toLowerCase() });
      if (!walletShards) {
        return res.status(404).json({ success: false, error: 'No wallet found for this email' } as ApiResponse);
      }

      const token = signToken({ userId: user._id.toString(), email: user.email });

      return res.json({
        success: true,
        data: {
          token,
          user: { id: user._id.toString(), email: user.email },
          isNewUser: false,
          hasWallet: true,
        },
      } as ApiResponse);
    } catch (err) {
      console.error('[Luna] OTP verify-existing error:', err);
      return res.status(500).json({ success: false, error: 'Failed to verify code' } as ApiResponse);
    }
  }
);

// POST /auth/login — Send OTP for login (existing user)
router.post(
  '/login',
  [body('email').isEmail().normalizeEmail()],
  async (req: Request, res: Response) => {
    const { email } = req.body as { email: string };

    try {
      const user = await UserModel.findOne({ email: email.toLowerCase() });
      if (!user) {
        // Don't reveal if user exists
        return res.json({ success: true, message: 'If this email is registered, a code will be sent.' } as ApiResponse);
      }

      const otp = generateOTP();

      // Invalidate previous OTPs
      await OTPModel.updateMany(
        { email: email.toLowerCase(), used: false },
        { used: true }
      );

      await OTPModel.create({
        email: email.toLowerCase(),
        code: otp,
        expiresAt: getOTPExpiry(10),
        used: false,
      });

      await sendOTPEmail(email, otp);
      console.log(`[Luna] Login OTP sent to ${email}`);

      return res.json({
        success: true,
        message: 'Verification code sent',
        ...(process.env.NODE_ENV === 'development' && { dev_otp: otp }),
      } as ApiResponse);
    } catch (err) {
      console.error('[Luna] Login OTP send error:', err);
      return res.status(500).json({ success: false, error: 'Failed to send verification code' } as ApiResponse);
    }
  }
);

// GET /auth/me — Get current user
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await UserModel.findById(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' } as ApiResponse);
    }

    const hasWallet = !!(await WalletShardModel.findOne({ email: user.email.toLowerCase() }));

    return res.json({
      success: true,
      data: { id: user._id.toString(), email: user.email, walletAddress: user.walletAddress, hasWallet },
    } as ApiResponse);
  } catch (err) {
    console.error('[Luna] Get user error:', err);
    return res.status(500).json({ success: false, error: 'Failed to get user info' } as ApiResponse);
  }
});

export default router;
