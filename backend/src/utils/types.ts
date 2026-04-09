export interface User {
  id: string;
  email: string;
  createdAt: Date;
  walletAddress?: string;
}

export interface OTPRecord {
  email: string;
  code: string;
  expiresAt: Date;
  used: boolean;
}

export interface EncryptedBackup {
  userId: string;
  email: string;
  encryptedKey: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface JWTPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export type NetworkType = 'mainnet' | 'preprod' | 'preview' | 'undeployed';
