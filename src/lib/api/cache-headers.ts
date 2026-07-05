/** Vercel-friendly cache headers for read-heavy API routes. */
export const API_CACHE = {
  /** Shared CDN + browser — Discover radar, OSS scan */
  publicShort: "public, s-maxage=60, stale-while-revalidate=120",
  /** Per-user private cache */
  privateShort: "private, max-age=30, stale-while-revalidate=90",
  /** Wallet / auth — never cache at edge */
  noStore: "private, no-store, max-age=0",
} as const;

export function rateLimitHeaders(remaining: number, resetAt: number): Record<string, string> {
  return {
    "X-RateLimit-Remaining": String(Math.max(0, remaining)),
    "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
  };
}
