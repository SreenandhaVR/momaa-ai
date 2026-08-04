import mongoose, { type Mongoose } from 'mongoose';

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

export async function connectDatabase(uri = process.env.MONGODB_URI): Promise<void> {
  if (!uri) {
    throw new Error('MONGODB_URI is required. Copy .env.example to .env and configure it.');
  }

  if (mongooseCache.connection && mongoose.connection.readyState === 1) return;

  // A cached connection can become stale after an explicit disconnect in tests or shutdown.
  if (mongooseCache.connection && mongoose.connection.readyState !== 1) {
    mongooseCache.connection = null;
    mongooseCache.promise = null;
  }

  if (!mongooseCache.promise) {
    mongooseCache.promise = mongoose
      .connect(uri, {
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
