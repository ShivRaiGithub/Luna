import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { WalletShardModel } from '../models/WalletShard';
import { OTPModel } from '../models/OTP';
import { ApiResponse } from '../utils/types';
import { authenticate, AuthRequest } from '../middleware/auth';
import { isOTPExpired } from '../utils/auth';
import { combineStrings, decryptKey, encryptKey, splitString } from '../utils/crypto';

const router = Router();

// All wallet routes require authentication
router.use(authenticate);

// POST /wallet/store-shards — Store server-side key halves (new wallet creation)
router.post(
  '/store-shards',
  [
    body('str1_1').isString().notEmpty(),
    body('str2_1').isString().notEmpty(),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Invalid shard data' } as ApiResponse);
    }

    const { str1_1, str2_1 } = req.body as { str1_1: string; str2_1: string };
    const email = req.userEmail!;

    try {
      // Check if shards already exist
      const existing = await WalletShardModel.findOne({ email: email.toLowerCase() });
      if (existing) {
        return res.status(409).json({ success: false, error: 'Wallet shards already exist for this email' } as ApiResponse);
      }

      await WalletShardModel.create({
        email: email.toLowerCase(),
        str1_1,
        str2_1,
      });

      return res.json({ success: true, message: 'Shards stored successfully' } as ApiResponse);
    } catch (err) {
      console.error('[Luna] Store shards error:', err);
      return res.status(500).json({ success: false, error: 'Failed to store wallet shards' } as ApiResponse);
    }
  }
);

// POST /wallet/get-shards — Retrieve server-side halves (requires OTP verification)
router.post(
  '/get-shards',
  [
    body('otp').isLength({ min: 6, max: 6 }).isNumeric(),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Invalid OTP' } as ApiResponse);
    }

    const { otp } = req.body as { otp: string };
    const email = req.userEmail!;

    try {
      // Verify OTP before releasing shards
      const otpRecord = await OTPModel.findOne({
        email: email.toLowerCase(),
        used: false,
      }).sort({ createdAt: -1 });

      if (!otpRecord) {
        return res.status(400).json({ success: false, error: 'No verification code found. Request a new one.' } as ApiResponse);
      }

      if (isOTPExpired(otpRecord.expiresAt)) {
        return res.status(400).json({ success: false, error: 'Verification code expired' } as ApiResponse);
      }

      if (otpRecord.code !== otp) {
        return res.status(400).json({ success: false, error: 'Invalid verification code' } as ApiResponse);
      }

      // Remove all OTPs for this email after successful verification
      await OTPModel.deleteMany({ email: email.toLowerCase() });

      // Fetch shards
      const shards = await WalletShardModel.findOne({ email: email.toLowerCase() });
      if (!shards) {
        return res.status(404).json({ success: false, error: 'No wallet shards found for this email' } as ApiResponse);
      }

      return res.json({
        success: true,
        data: {
          str1_1: shards.str1_1,
          str2_1: shards.str2_1,
        },
      } as ApiResponse);
    } catch (err) {
      console.error('[Luna] Get shards error:', err);
      return res.status(500).json({ success: false, error: 'Failed to retrieve wallet shards' } as ApiResponse);
    }
  }
);

// GET /wallet/get-shards-auth — Retrieve server-side halves for already OTP-verified authenticated session
router.get('/get-shards-auth', async (req: AuthRequest, res: Response) => {
  const email = req.userEmail!;

  try {
    const shards = await WalletShardModel.findOne({ email: email.toLowerCase() });
    if (!shards) {
      return res.status(404).json({ success: false, error: 'No wallet shards found for this email' } as ApiResponse);
    }

    return res.json({
      success: true,
      data: {
        str1_1: shards.str1_1,
        str2_1: shards.str2_1,
      },
    } as ApiResponse);
  } catch (err) {
    console.error('[Luna] Get shards auth error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve wallet shards' } as ApiResponse);
  }
});

// POST /wallet/update-shards — Update str1_1 after password reset (requires OTP)
router.post(
  '/update-shards',
  [
    body('str1_1').isString().notEmpty(),
    body('str2_1').isString().notEmpty(),
    body('otp').isLength({ min: 6, max: 6 }).isNumeric(),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Invalid input' } as ApiResponse);
    }

    const { str1_1, str2_1, otp } = req.body as { str1_1: string; str2_1: string; otp: string };
    const email = req.userEmail!;

    try {
      // Verify OTP
      const otpRecord = await OTPModel.findOne({
        email: email.toLowerCase(),
        used: false,
      }).sort({ createdAt: -1 });

      if (!otpRecord) {
        return res.status(400).json({ success: false, error: 'No verification code found' } as ApiResponse);
      }

      if (isOTPExpired(otpRecord.expiresAt)) {
        return res.status(400).json({ success: false, error: 'Verification code expired' } as ApiResponse);
      }

      if (otpRecord.code !== otp) {
        return res.status(400).json({ success: false, error: 'Invalid verification code' } as ApiResponse);
      }

      await OTPModel.deleteMany({ email: email.toLowerCase() });

      // Update shards
      const updated = await WalletShardModel.findOneAndUpdate(
        { email: email.toLowerCase() },
        { str1_1, str2_1 },
        { new: true }
      );

      if (!updated) {
        return res.status(404).json({ success: false, error: 'No wallet shards found to update' } as ApiResponse);
      }

      return res.json({ success: true, message: 'Shards updated successfully' } as ApiResponse);
    } catch (err) {
      console.error('[Luna] Update shards error:', err);
      return res.status(500).json({ success: false, error: 'Failed to update wallet shards' } as ApiResponse);
    }
  }
);

// POST /wallet/reset-password — Single-session password reset using backup credentials
router.post(
  '/reset-password',
  [
    body('backupPass').isString().isLength({ min: 6 }),
    body('newPassword').isString().isLength({ min: 6 }),
    body('str2_2').isString().notEmpty(),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Invalid reset payload' } as ApiResponse);
    }

    const { backupPass, newPassword, str2_2 } = req.body as {
      backupPass: string;
      newPassword: string;
      str2_2: string;
    };
    const email = req.userEmail!;

    try {
      const shards = await WalletShardModel.findOne({ email: email.toLowerCase() });
      if (!shards) {
        return res.status(404).json({ success: false, error: 'No wallet shards found for this email' } as ApiResponse);
      }

      const encryptedBackup = combineStrings(shards.str2_1, str2_2);
      let privateKey: string;
      try {
        privateKey = decryptKey(encryptedBackup, backupPass);
      } catch {
        return res.status(400).json({ success: false, error: 'Invalid backup password or backup file' } as ApiResponse);
      }

      const newEncryptedLogin = encryptKey(privateKey, newPassword);
      const [newStr1_1, newStr1_2] = splitString(newEncryptedLogin);

      // Only rotate the login shard pair. Backup shard pair remains unchanged.
      shards.str1_1 = newStr1_1;
      await shards.save();

      const backupFileContent = JSON.stringify({
        str1_2: newStr1_2,
        str2_2,
        email,
        version: 2,
      }, null, 2);

      return res.json({
        success: true,
        data: {
          encryptedStr1: newEncryptedLogin,
          backupFileContent,
        },
      } as ApiResponse);
    } catch (err) {
      console.error('[Luna] Reset password error:', err);
      return res.status(500).json({ success: false, error: 'Failed to reset password' } as ApiResponse);
    }
  }
);

// GET /wallet/check — Check if wallet shards exist for authenticated user
router.get('/check', async (req: AuthRequest, res: Response) => {
  const email = req.userEmail!;

  try {
    const shards = await WalletShardModel.findOne({ email: email.toLowerCase() });
    return res.json({
      success: true,
      data: { exists: !!shards },
    } as ApiResponse);
  } catch (err) {
    console.error('[Luna] Check wallet error:', err);
    return res.status(500).json({ success: false, error: 'Failed to check wallet status' } as ApiResponse);
  }
});

export default router;
