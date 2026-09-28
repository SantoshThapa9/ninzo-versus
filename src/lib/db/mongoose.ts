import mongoose from "mongoose";
import { requireEnv } from "@/config/env";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as unknown as { mongooseCache?: MongooseCache };

const cache: MongooseCache = globalForMongoose.mongooseCache ?? {
  conn: null,
  promise: null,
};

globalForMongoose.mongooseCache = cache;

export async function connectDb() {
  if (cache.conn) return cache.conn;
  if (!cache.promise) {
    const uri = requireEnv("MONGODB_URI");
    cache.promise = mongoose.connect(uri, {
      bufferCommands: false,
      // Do not leave a route transition waiting on MongoDB's 30 second
      // default when the network or database is unavailable.
      serverSelectionTimeoutMS: 8_000,
      connectTimeoutMS: 8_000,
    });
  }
  try {
    cache.conn = await cache.promise;
    return cache.conn;
  } catch (error) {
    // A rejected promise must never be retained: otherwise every later page
    // navigation reuses the failed attempt instead of making a fresh one.
    cache.promise = null;
    throw error;
  }
}

export async function withTransaction<T>(
  work: (session: mongoose.ClientSession) => Promise<T>,
): Promise<T> {
  await connectDb();
  const session = await mongoose.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}
