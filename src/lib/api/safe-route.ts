import { NextResponse } from "next/server";
import { API_CACHE, rateLimitHeaders } from "@/lib/api/cache-headers";
import { fetchResilient } from "@/lib/api/fetch-resilient";
import { reportApiError } from "@/lib/api/report-error";
import { cacheGetOrSetResilient, cacheReadStale } from "@/lib/cache/kv";
import { getRequestClientId, rateLimitRequest } from "@/lib/cache/rate-limit";

export type SafeGetOptions<T> = {
  scope: string;
  fallback: T;
  cacheControl?: string;
  rateLimit?: { limit: number; windowSeconds: number; keyPrefix: string; userId?: string | null };
  /** Return 429 when rate limited (default: serve fallback with 200) */
  rateLimitStrict?: boolean;
  /** Redis cache with stale fallback on upstream failure */
  redisCache?: { key: string; ttlSeconds: number; staleSeconds?: number };
};

/**
 * Wrap expensive GET handlers — rate limit, try/catch, degraded JSON on failure.
 * Never throws; page clients always get parseable JSON.
 */
export async function safeApiGet<T extends Record<string, unknown>>(
  req: Request,
  handler: () => Promise<T>,
  options: SafeGetOptions<T>,
): Promise<NextResponse> {
  const { scope, fallback, cacheControl = API_CACHE.noStore } = options;

  if (options.rateLimit) {
    const clientId = getRequestClientId(req, options.rateLimit.userId);
    const rlKey = `${options.rateLimit.keyPrefix}:${clientId}`;
    const rl = await rateLimitRequest(rlKey, options.rateLimit.limit, options.rateLimit.windowSeconds);

    if (!rl.success) {
      if (options.rateLimitStrict) {
        return NextResponse.json(
          { ...fallback, rateLimited: true, message: "Too many requests — try again shortly." },
          {
            status: 429,
            headers: {
              ...rateLimitHeaders(rl.remaining, rl.resetAt),
              "Cache-Control": API_CACHE.noStore,
            },
          },
        );
      }
      return NextResponse.json(
        { ...fallback, degraded: true, rateLimited: true },
        {
          status: 200,
          headers: {
            ...rateLimitHeaders(rl.remaining, rl.resetAt),
            "Cache-Control": cacheControl,
          },
        },
      );
    }
  }

  const runHandler = async (): Promise<T> => {
    if (options.redisCache) {
      const { key, ttlSeconds, staleSeconds } = options.redisCache;
      return cacheGetOrSetResilient(key, ttlSeconds, handler, { staleSeconds });
    }
    return handler();
  };

  try {
    const body = await runHandler();
    return NextResponse.json(body, {
      status: 200,
      headers: { "Cache-Control": cacheControl },
    });
  } catch (error) {
    reportApiError(scope, error);

    if (options.redisCache) {
      const stale = await cacheReadStale<T>(options.redisCache.key);
      if (stale) {
        return NextResponse.json(
          { ...stale, degraded: true, stale: true, error: "upstream_unavailable" },
          {
            status: 200,
            headers: { "Cache-Control": cacheControl },
          },
        );
      }
    }

    return NextResponse.json(
      { ...fallback, degraded: true, error: "upstream_unavailable" },
      {
        status: 200,
        headers: { "Cache-Control": API_CACHE.noStore },
      },
    );
  }
}

/** @deprecated Use fetchResilient — kept for backward compatibility */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response | null> {
  return fetchResilient(url, init);
}

export { fetchResilient };
