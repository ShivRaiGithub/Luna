import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { JWTPayload } from './types';

dotenv.config({ override: true });

const JWT_SECRET = process.env.JWT_SECRET || 'luna-dev-secret-change-in-prod';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY } as jwt.SignOptions);
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}

export function generateOTP(length = 6): string {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * digits.length)];
  }
  return otp;
}

export function getOTPExpiry(minutes = 10): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

export function isOTPExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}
