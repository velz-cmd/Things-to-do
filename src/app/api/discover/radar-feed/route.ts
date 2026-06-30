import { NextResponse } from "next/server";
import { emptyBundle } from "@/lib/discover/domain-radar-actions";
import { buildDiscoverRadarFeed } from "@/lib/discover/radar-feed";

/** Unified Discover feed — gaps, pulse metrics, domain radars. */
export async function GET(req: Request) {
  const limit = Number(new URL(req.url).searchParams.get("limit") ?? 24);
  try {
    const feed = await buildDiscoverRadarFeed(Math.min(Math.max(limit, 1), 24));
    return NextResponse.json(feed);
  } catch (e) {
    console.error("[discover/radar-feed]", e);
    return NextResponse.json(
      {
        ok: false,
        error: "radar_feed_unavailable",
        gaps: [],
        radars: { oss: [], music: [], dao: [] },
        domainRadars: {
          oss: emptyBundle("oss"),
          music: emptyBundle("music"),
          dao: emptyBundle("dao"),
        },
        emptyStates: [],
        intelligence: null,
        fundableCount: 0,
        ossSignalCount: 0,
        realSignalCount: 0,
        githubScanAt: null,
        claimHint: null,
        updatedAt: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
