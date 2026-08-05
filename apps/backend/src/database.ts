import dotenv from 'dotenv';
import mongoose, { type Mongoose } from 'mongoose';
import path from 'path';

type MongooseCache = {
  connection: Mongoose | null;
  promise: Promise<Mongoose> | null;
};

const globalForMongoose = globalThis as typeof globalThis & {
  __momaaMongoose?: MongooseCache;
};

const mongooseCache: MongooseCache = (globalForMongoose.__momaaMongoose ??= {
  connection: null,
  promise: null
});

function ensureEnvLoaded(): void {
  if (!process.env.MONGODB_URI) {
    dotenv.config({ path: path.resolve(process.cwd(), 'apps/backend/.env') });
    dotenv.config({ path: path.resolve(process.cwd(), '.env') });
    dotenv.config();
  }
}

export async function connectDatabase(uri?: string): Promise<void> {
  ensureEnvLoaded();
  const targetUri = uri || process.env.MONGODB_URI;

  if (!targetUri) {
    throw new Error(
      'MONGODB_URI is required.\n' +
      '• For local development: Copy apps/backend/.env.example to apps/backend/.env and set MONGODB_URI.\n' +
      '• For Vercel deployment: Add MONGODB_URI in Vercel Project Settings > Environment Variables.'
    );
  }

  if (mongooseCache.connection && mongoose.connection.readyState === 1) return;

  // A cached connection can become stale after an explicit disconnect in tests or shutdown.
  if (mongooseCache.connection && mongoose.connection.readyState !== 1) {
    mongooseCache.connection = null;
    mongooseCache.promise = null;
  }

  if (!mongooseCache.promise) {
    mongooseCache.promise = mongoose
      .connect(targetUri, {
        connectTimeoutMS: 5_000,
        serverSelectionTimeoutMS: 5_000
      })
      .catch((error: unknown) => {
        mongooseCache.promise = null;
        mongooseCache.connection = null;
        throw error;
      });
  }

  mongooseCache.connection = await mongooseCache.promise;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  mongooseCache.connection = null;
  mongooseCache.promise = null;
}

