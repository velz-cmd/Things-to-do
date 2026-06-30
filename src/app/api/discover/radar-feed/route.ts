import { NextResponse } from "next/server";
import { buildDiscoverRadarFeed } from "@/lib/discover/radar-feed";

/** Unified Discover feed — gaps, pulse metrics, domain radars, claim hint. */
export async function GET(req: Request) {
  const limit = Number(new URL(req.url).searchParams.get("limit") ?? 24);
  try {
    const feed = await buildDiscoverRadarFeed(Math.min(Math.max(limit, 1), 24));
    return NextResponse.json(feed);
  } catch (e) {
    console.error("[discover/radar-feed]", e);
    return NextResponse.json(
      {
        ok: true,
        gaps: [],
        radars: { oss: [], music: [], dao: [] },
        emptyStates: [],
        intelligence: null,
        fundableCount: 0,
        ossSignalCount: 0,
        realSignalCount: 0,
        githubScanAt: null,
        claimHint: null,
        updatedAt: new Date().toISOString(),
      },
      { status: 200 },
    );
  }
}
