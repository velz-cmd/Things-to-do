import { NextResponse } from "next/server";
import { buildDiscoverRadarFeed } from "@/lib/discover/radar-feed";

/** @deprecated Prefer GET /api/discover/radar-feed */
export async function GET() {
  try {
    const feed = await buildDiscoverRadarFeed(24);
    return NextResponse.json({
      ok: true,
      intelligence: feed.intelligence,
      fundableCount: feed.fundableCount,
      ossSignalCount: feed.ossSignalCount,
      claimHint: feed.claimHint,
      updatedAt: feed.updatedAt,
    });
  } catch (e) {
    console.error("[discover/overview]", e);
    return NextResponse.json({
      ok: true,
      intelligence: null,
      fundableCount: 0,
      ossSignalCount: 0,
      claimHint: null,
      updatedAt: new Date().toISOString(),
    });
  }
}
