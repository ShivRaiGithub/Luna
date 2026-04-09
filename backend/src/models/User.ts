import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  walletAddress?: string;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    walletAddress: {
      type: String,
      default: undefined,
    },
  },
  {
    timestamps: true,
  }
);

UserSchema.index({ email: 1 }, { unique: true });

export const UserModel = mongoose.model<IUser>('User', UserSchema);
