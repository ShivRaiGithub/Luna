import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ override: true });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/luna';

export async function connectDB(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log(`[Luna] ✓ MongoDB connected: ${mongoose.connection.host}`);
  } catch (err) {
    console.error('[Luna] ✗ MongoDB connection error:', err);
    process.exit(1);
  }

  mongoose.connection.on('error', (err) => {
    console.error('[Luna] MongoDB error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[Luna] MongoDB disconnected. Attempting reconnect...');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('[Luna] ✓ MongoDB reconnected');
  });
}
