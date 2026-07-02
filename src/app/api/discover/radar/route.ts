import { NextResponse } from "next/server";
import { buildDiscoverRadar } from "@/lib/discover/radar";
import { withTimeout } from "@/lib/discover/fetch-timeout";

export const maxDuration = 60;

const RADAR_CACHE_MS = 30_000;
const RADAR_BUILD_TIMEOUT_MS = 12_000;
let radarCache: { at: number; body: Awaited<ReturnType<typeof buildDiscoverRadar>> } | null =
  null;

/** Discover global radar — real authorizations, timeline, graph slice only */
export async function GET() {
  const now = Date.now();
  if (radarCache && now - radarCache.at < RADAR_CACHE_MS) {
    return NextResponse.json(radarCache.body, {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
      },
    });
  }

  try {
    const radar = await withTimeout(buildDiscoverRadar(), RADAR_BUILD_TIMEOUT_MS, null);
    if (!radar) {
      return NextResponse.json(
        { ok: false, degraded: true, graph: { nodes: [], edges: [] }, timeline: [] },
        { status: 200 },
      );
    }
    radarCache = { at: now, body: radar };
    return NextResponse.json(radar, {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
      },
    });
  } catch (e) {
    console.error("[discover/radar]", e);
    return NextResponse.json(
      {
        ok: true,
        live: false,
        activity: [],
        graph: { nodes: [], edges: [] },
        metrics: {
          topNodes: [],
          fundingEntropy: {
            entropy: 0,
            maxEntropy: 0,
            concentrationPct: 0,
            evidence: "Radar unavailable — database not connected.",
          },
        },
        emptyReason: "Connect DATABASE_URL to stream live value events.",
        updatedAt: new Date().toISOString(),
      },
      { status: 200 },
    );
  }
}
