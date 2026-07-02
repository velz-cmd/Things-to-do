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
      "resolve:discover:radar-feed:* (30s)",
      "resolve:oss:opportunities (60s)",
      "resolve:integrations:health (180s)",
    ],
    note:
      configured && ping?.ok ?
        "Redis is live — Discover, OSS scan, and integration health are shared across Vercel instances."
      : configured ?
        "Redis env vars are set but ping failed — check UPSTASH_REDIS_REST_TOKEN on Vercel Production."
      : "Add UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN on Vercel, then redeploy. Falls back to in-process memory until then.",
  });
}
