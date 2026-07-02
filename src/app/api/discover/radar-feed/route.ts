import { NextResponse } from "next/server";
import { buildDiscoverRadarFeedSafe } from "@/lib/discover/radar-feed";

export const maxDuration = 60;

/** Unified Discover feed — gaps, pulse metrics, domain radars. Always returns usable JSON. */
export async function GET(req: Request) {
  const limit = Number(new URL(req.url).searchParams.get("limit") ?? 24);
  const feed = await buildDiscoverRadarFeedSafe(Math.min(Math.max(limit, 1), 48));
  return NextResponse.json(feed, {
    headers: {
      "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
    },
  });
}
