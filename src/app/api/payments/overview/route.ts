import { NextResponse } from "next/server";
import { getGlobalAuthorizationSummary, getAuthorizationHistory } from "@/lib/authorization/ledger";
import { getArcReadiness } from "@/lib/treasury/arc-readiness";
import { getTreasuryStats } from "@/lib/treasury/distribute";
import { prisma } from "@/lib/db";

const EMPTY_LEDGER = {
  authorizedUsd: 0,
  pendingFundingUsd: 0,
  claimableUsd: 0,
  settledUsd: 0,
  count: 0,
};

/** Financial operating system snapshot — real treasury + ledger + settlements */
export async function GET() {
  const [arc, stats, ledger, recentAuthorizations, settlements] = await Promise.all([
    getArcReadiness(),
    getTreasuryStats().catch(() => ({
      totalDistributedUsd: 0,
      batchCount: 0,
      contributorCount: 0,
      recentBatches: [],
      missionSettledUsd: 0,
    })),
    getGlobalAuthorizationSummary().catch(() => EMPTY_LEDGER),
    getAuthorizationHistory(20).catch(() => []),
    prisma.missionSettlement
      .findMany({
        orderBy: { createdAt: "desc" },
        take: 15,
        select: {
          id: true,
          missionId: true,
          repo: true,
          status: true,
          treasuryAmount: true,
          createdAt: true,
          escrowTxHash: true,
        },
      })
      .catch(() => []),
  ]);

  return NextResponse.json({
    treasury: {
      balanceUsd: arc.balanceUsd ?? 0,
      liveArc: arc.liveArc,
      canDistributeOnChain: arc.canDistributeOnChain,
      message: arc.message,
      totalDistributedUsd: stats.totalDistributedUsd ?? 0,
      batchCount: stats.batchCount ?? 0,
    },
    ledger,
    recentAuthorizations: recentAuthorizations.map((a) => ({
      id: a.id,
      connectorId: a.connectorId,
      missionId: a.missionId,
      payeeKey: a.payeeKey,
      amountUsd: a.amountUsd,
      status: a.status,
      contextLabel: a.contextLabel,
      updatedAt: a.updatedAt,
    })),
    settlements,
    updatedAt: new Date().toISOString(),
  });
}
