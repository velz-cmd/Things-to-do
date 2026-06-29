import { NextResponse } from "next/server";
import { getTreasuryStats } from "@/lib/treasury/distribute";
import { getArcReadiness } from "@/lib/treasury/arc-readiness";
import { seedContributorRegistry } from "@/lib/registry/seed";
import { seedProductionArtistRegistry } from "@/lib/registry/production-artists";
import { isDeputyDemoMode } from "@/lib/config/demo-mode";

export async function GET() {
  const [stats, arc] = await Promise.all([getTreasuryStats(), getArcReadiness()]);
  return NextResponse.json({
    ...stats,
    balanceUsd: arc.balanceUsd ?? 0,
    treasuryUsd: arc.balanceUsd ?? 0,
    liveArc: arc.liveArc,
    canDistributeOnChain: arc.canDistributeOnChain,
    treasuryMessage: arc.message,
  });
}

export async function POST() {
  if (isDeputyDemoMode()) {
    const seeded = await seedContributorRegistry();
    return NextResponse.json({ ok: true, seeded, source: "legacy" });
  }
  const result = await seedProductionArtistRegistry();
  return NextResponse.json({ ok: true, ...result, source: "production" });
}
