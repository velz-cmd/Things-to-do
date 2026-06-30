import { NextResponse } from "next/server";
import { buildDiscoverRadarFeed } from "@/lib/discover/radar-feed";

/** @deprecated Prefer GET /api/discover/radar-feed */
export async function GET(req: Request) {
  const limit = Number(new URL(req.url).searchParams.get("limit") ?? 12);
  try {
    const feed = await buildDiscoverRadarFeed(Math.min(Math.max(limit, 1), 24));
    return NextResponse.json({
      ok: true,
      gaps: feed.gaps.slice(0, Math.min(Math.max(limit, 1), 24)),
      updatedAt: feed.updatedAt,
    });
  } catch (e) {
    console.error("[discover/trending]", e);
    return NextResponse.json({ ok: true, gaps: [], updatedAt: new Date().toISOString() });
  }
}
