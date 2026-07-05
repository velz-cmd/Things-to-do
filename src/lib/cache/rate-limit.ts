import { Ratelimit } from "@upstash/ratelimit";
import { getRedisClient } from "@/lib/cache/redis";

const memoryBuckets = new Map<string, { count: number; resetAt: number }>();

export type RateLimitResult = {
  success: boolean;
  remaining: number;
  resetAt: number;
};

/** Sliding-window rate limit — Upstash when configured, in-memory otherwise. */
export async function rateLimitRequest(
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const key = identifier.startsWith("resolve:rl:") ? identifier : `resolve:rl:${identifier}`;
  const redis = getRedisClient();

  if (redis) {
    try {
      const ratelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
        prefix: "resolve:rl",
        analytics: false,
      });
      const result = await ratelimit.limit(key);
      return {
        success: result.success,
        remaining: result.remaining,
        resetAt: result.reset,
      };
    } catch (e) {
      console.warn("[rate-limit] redis failed, using memory:", e);
    }
  }

  const now = Date.now();
  const bucket = memoryBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { success: true, remaining: limit - 1, resetAt: now + windowSeconds * 1000 };
  }

  if (bucket.count >= limit) {
    return { success: false, remaining: 0, resetAt: bucket.resetAt };
  }

  bucket.count += 1;
  return { success: true, remaining: limit - bucket.count, resetAt: bucket.resetAt };
}

export function getRequestClientId(req: Request, userId?: string | null): string {
  if (userId) return `user:${userId}`;
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "anon";
  return `ip:${ip}`;
}
