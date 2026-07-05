import { NextResponse } from "next/server";
import { isRedisConfigured, verifyRedisConnection } from "@/lib/cache/redis";
import { RESILIENCE_REGISTRY } from "@/lib/api/resilience-registry";

export const runtime = "edge";

/** Safe Redis + Sentry diagnostics — never returns secret values. */
export async function GET() {
  const configured = isRedisConfigured();
  const ping = configured ? await verifyRedisConnection() : null;
  const sentryDsn = Boolean(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN);

  return NextResponse.json({
    ok: Boolean(ping?.ok) && sentryDsn,
    redis: {
      configured,
      ping,
    },
    sentry: {
      configured: sentryDsn,
      org: process.env.SENTRY_ORG ?? "resolve-n2",
      project: process.env.SENTRY_PROJECT ?? "javascript-nextjs",
      sourcemapsOnBuild: Boolean(process.env.SENTRY_AUTH_TOKEN),
      clientDsn: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
      serverDsn: Boolean(process.env.SENTRY_DSN),
    },
    caches: RESILIENCE_REGISTRY.caches,
    rateLimits: RESILIENCE_REGISTRY.rateLimits,
    safeApiRoutes: RESILIENCE_REGISTRY.safeApiRoutes,
    note:
      configured && ping?.ok ?
        "Redis is live — shared cache + rate limits across Vercel instances."
      : configured ?
        "Redis env vars set but ping failed — check UPSTASH_REDIS_REST_TOKEN on Vercel Production."
      : "Add UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN on Vercel. Falls back to in-process memory until then.",
  });
}
