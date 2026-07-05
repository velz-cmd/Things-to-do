import { NextResponse } from "next/server";
import { isRedisConfigured, verifyRedisConnection } from "@/lib/cache/redis";

export const runtime = "edge";

/** Safe Redis diagnostics — never returns secret values. */
export async function GET() {
  const configured = isRedisConfigured();
  const ping = configured ? await verifyRedisConnection() : null;

  return NextResponse.json({
    ok: Boolean(ping?.ok),
    configured,
    ping,
    caches: [
      "resolve:discover:radar-feed:* (90s)",
      "resolve:discover:radar:v1 (30s)",
      "resolve:discover:search:* (45s)",
      "resolve:profile:bootstrap:* (30s)",
      "resolve:oss:opportunities (60s)",
      "resolve:integrations:health (180s)",
      "resolve:arc:balance:* (20s)",
    ],
    rateLimits: [
      "resolve:rl:discover:*",
      "resolve:rl:capital:state:*",
      "resolve:rl:github:opportunities",
      "resolve:rl:profile:bootstrap:*",
    ],
    observability: {
      sentry: Boolean(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN),
    },
    note:
      configured && ping?.ok ?
        "Redis is live — Discover, OSS scan, rate limits, and integration health are shared across Vercel instances."
      : configured ?
        "Redis env vars are set but ping failed — check UPSTASH_REDIS_REST_TOKEN on Vercel Production."
      : "Add UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN on Vercel, then redeploy. Falls back to in-process memory until then.",
  });
}
