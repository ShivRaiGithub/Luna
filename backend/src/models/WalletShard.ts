import mongoose, { Schema, Document } from 'mongoose';

export interface IWalletShard extends Document {
  email: string;
  str1_1: string;  // first half of password-encrypted key
  str2_1: string;  // first half of backupPass-encrypted key
  createdAt: Date;
  updatedAt: Date;
}

const WalletShardSchema = new Schema<IWalletShard>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    str1_1: {
      type: String,
      required: true,
    },
    str2_1: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

WalletShardSchema.index({ email: 1 }, { unique: true });

export const WalletShardModel = mongoose.model<IWalletShard>('WalletShard', WalletShardSchema);
