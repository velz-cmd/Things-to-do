import { Redis } from "@upstash/redis";

let client: Redis | null | undefined;

/** Upstash REST Redis — shared cache across Vercel serverless instances. */
export function getRedisClient(): Redis | null {
  if (client !== undefined) return client;

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ||
    process.env.UPSTASH_REDIS_REST_READ_ONLY_TOKEN?.trim();

  if (!url || !token) {
    client = null;
    return null;
  }

  client = new Redis({ url, token });
  return client;
}

export function isRedisConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
      (process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ||
        process.env.UPSTASH_REDIS_REST_READ_ONLY_TOKEN?.trim()),
  );
}

/** Ping Upstash — confirms credentials without exposing values. */
export async function verifyRedisConnection(): Promise<
  { ok: true } | { ok: false; message: string }
> {
  const redis = getRedisClient();
  if (!redis) {
    return { ok: false, message: "UPSTASH_REDIS_REST_URL or token is not set." };
  }

  try {
    const pong = await redis.ping();
    if (pong !== "PONG") {
      return { ok: false, message: `Unexpected ping response: ${String(pong)}` };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Redis ping failed",
    };
  }
}
