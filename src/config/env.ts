import { z } from "zod";

function resolveRedisUrl() {
  const configured = process.env.REDIS_URL;
  if (configured) return configured;

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL ?? process.env.UPSTASH_REDIS_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.UPSTASH_REDIS_TOKEN;
  if (!upstashUrl || !upstashToken) return undefined;

  try {
    const parsed = new URL(upstashUrl);
    const host = parsed.hostname;
    return `rediss://default:${encodeURIComponent(upstashToken)}@${host}:6379`;
  } catch {
    return undefined;
  }
}

const envSchema = z.object({
  MONGODB_URI: z.string().min(1).optional(),
  REDIS_URL: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  AUTH_SECRET: z.string().optional(),
  AUTH_URL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  CASHFREE_CLIENT_ID: z.string().optional(),
  CASHFREE_CLIENT_SECRET: z.string().optional(),
  CASHFREE_ENV: z.enum(["sandbox", "production"]).optional(),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  // Comma-separated allowlist of administrator email addresses.
  ADMIN_BOOTSTRAP_EMAIL: z.string().optional(),
  NEXT_PUBLIC_APP_NAME: z.string().optional(),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().url().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

export function getEnv(): AppEnv {
  return envSchema.parse({
    MONGODB_URI: process.env.MONGODB_URI,
    REDIS_URL: resolveRedisUrl(),
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_URL: process.env.AUTH_URL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    CASHFREE_CLIENT_ID: process.env.CASHFREE_CLIENT_ID,
    CASHFREE_CLIENT_SECRET: process.env.CASHFREE_CLIENT_SECRET,
    CASHFREE_ENV: process.env.CASHFREE_ENV,
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
    CRON_SECRET: process.env.CRON_SECRET,
    ADMIN_BOOTSTRAP_EMAIL: process.env.ADMIN_BOOTSTRAP_EMAIL,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
    VAPID_SUBJECT: process.env.VAPID_SUBJECT,
  });
}

export function requireEnv<K extends keyof AppEnv>(key: K): NonNullable<AppEnv[K]> {
  const value = getEnv()[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${String(key)}`);
  }
  return value;
}
