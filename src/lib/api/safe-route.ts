import { NextResponse } from "next/server";
import { API_CACHE, rateLimitHeaders } from "@/lib/api/cache-headers";
import { reportApiError } from "@/lib/api/report-error";
import { getRequestClientId, rateLimitRequest } from "@/lib/cache/rate-limit";

export type SafeGetOptions<T> = {
  scope: string;
  fallback: T;
  cacheControl?: string;
  rateLimit?: { limit: number; windowSeconds: number; keyPrefix: string; userId?: string | null };
  /** Return 429 when rate limited (default: serve fallback with 200) */
  rateLimitStrict?: boolean;
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

  try {
    const body = await handler();
    return NextResponse.json(body, {
      status: 200,
      headers: { "Cache-Control": cacheControl },
    });
  } catch (error) {
    reportApiError(scope, error);
    return NextResponse.json(
      { ...fallback, degraded: true, error: "upstream_unavailable" },
      {
        status: 200,
        headers: { "Cache-Control": API_CACHE.noStore },
      },
    );
  }
}

/** Server-side fetch with AbortController timeout — returns null on failure. */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response | null> {
  const { timeoutMs = 12_000, signal: parentSignal, ...rest } = init;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const onParentAbort = () => controller.abort();
  parentSignal?.addEventListener("abort", onParentAbort);

  try {
    return await fetch(url, { ...rest, signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
    parentSignal?.removeEventListener("abort", onParentAbort);
  }
}
