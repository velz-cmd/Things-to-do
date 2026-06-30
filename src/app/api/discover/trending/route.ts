import { NextResponse } from "next/server";
import { buildTrendingValueGaps } from "@/lib/discover/trending-gaps";

export async function GET(req: Request) {
  const limit = Number(new URL(req.url).searchParams.get("limit") ?? 12);
  try {
    const gaps = await buildTrendingValueGaps(Math.min(Math.max(limit, 1), 24));
    return NextResponse.json({ ok: true, gaps, updatedAt: new Date().toISOString() });
  } catch (e) {
    console.error("[discover/trending]", e);
    return NextResponse.json({ ok: true, gaps: [], updatedAt: new Date().toISOString() });
  }
}
