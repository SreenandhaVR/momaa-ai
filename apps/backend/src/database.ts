import mongoose from 'mongoose';

export async function connectDatabase(uri = process.env.MONGODB_URI): Promise<void> {
  if (!uri) {
    throw new Error('MONGODB_URI is required. Copy .env.example to .env and configure it.');
  }

  await mongoose.connect(uri);
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
