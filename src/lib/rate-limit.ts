import { getRedis } from "@/lib/redis";
import { AppError } from "@/lib/errors";

export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  const redis = getRedis();
  if (!redis) return;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, windowSeconds);
  }
  if (count > limit) {
    throw new AppError("Too many requests. Please wait and try again.", "RATE_LIMITED", 429);
  }
}
