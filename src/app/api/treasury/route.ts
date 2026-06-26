import { NextResponse } from "next/server";
import { getTreasuryStats } from "@/lib/treasury/distribute";
import { getArcReadiness } from "@/lib/treasury/arc-readiness";
import { seedContributorRegistry } from "@/lib/registry/seed";

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
  const seeded = await seedContributorRegistry();
  return NextResponse.json({ ok: true, seeded });
}
