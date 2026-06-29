import { NextResponse } from "next/server";
import { requireReadyUser } from "@/lib/auth/session";
import { listFunderPortfolio } from "@/lib/capital/yield-service";

export async function GET() {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const stakes = await listFunderPortfolio(ready.profile.id);
  const totalPrincipal = stakes.reduce((s, x) => s + x.principalUsd, 0);
  const totalImpact = stakes.reduce((s, x) => s + x.attributedImpactUsd, 0);
  const targetsMet = stakes.filter((s) => s.targetMet).length;

  return NextResponse.json({
    ok: true,
    stakes,
    summary: {
      totalPrincipalUsd: Math.round(totalPrincipal * 100) / 100,
      totalAttributedImpactUsd: Math.round(totalImpact * 100) / 100,
      portfolioMultiplier:
        totalPrincipal > 0 ?
          Math.round((totalImpact / totalPrincipal) * 100) / 100
        : 0,
      targetsMet,
      stakeCount: stakes.length,
    },
  });
}
