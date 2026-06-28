import { NextResponse } from "next/server";
import { buildDiscoverRadar } from "@/lib/discover/radar";

/** Discover global radar — real authorizations, timeline, graph slice only */
export async function GET() {
  try {
    const radar = await buildDiscoverRadar();
    return NextResponse.json(radar);
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
