import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/auth';
import { UserModel } from '../models/User';
import { ApiResponse } from '../utils/types';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Missing authorization token' } as ApiResponse);
    return;
  }

  const token = header.slice(7);
  try {
    const payload = verifyToken(token);

    // Look up user in MongoDB
    let user = await UserModel.findById(payload.userId);

    // Recover by email if ID mismatch (e.g. after DB migration)
    if (!user) {
      user = await UserModel.findOne({ email: payload.email.toLowerCase() });
      if (!user) {
        // Auto-create user from valid JWT payload (backwards compat after migration)
        user = await UserModel.create({
          email: payload.email.toLowerCase(),
        });
      }
    }

    req.userId = user._id.toString();
    req.userEmail = user.email;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' } as ApiResponse);
  }
}

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  console.error('[Luna Error]', err.message);
  res.status(500).json({ success: false, error: 'Internal server error' } as ApiResponse);
}
