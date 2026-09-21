import Redis from "ioredis";
import { getEnv } from "@/config/env";

const globalForRedis = globalThis as unknown as { redis?: Redis | null };

export function getRedis() {
  const url = getEnv().REDIS_URL;
  if (!url) return null;
  if (!globalForRedis.redis) {
    globalForRedis.redis = new Redis(url, { maxRetriesPerRequest: 3 });
  }
  return globalForRedis.redis;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;
  const value = await redis.get(key);
  return value ? (JSON.parse(value) as T) : null;
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number) {
  const redis = getRedis();
  if (!redis) return;
  await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
}

export async function cacheDel(key: string) {
  const redis = getRedis();
  if (!redis) return;
  await redis.del(key);
}
