import mongoose, { Schema, Document } from 'mongoose';

export interface IOTP extends Document {
  email: string;
  code: string;
  expiresAt: Date;
  used: boolean;
}

const OTPSchema = new Schema<IOTP>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    used: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// TTL index: MongoDB auto-deletes expired OTPs after 1 hour past expiry
OTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });
OTPSchema.index({ email: 1 });

export const OTPModel = mongoose.model<IOTP>('OTP', OTPSchema);
