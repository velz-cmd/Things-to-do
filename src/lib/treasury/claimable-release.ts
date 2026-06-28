import { prisma } from "@/lib/db";
import { notifyClaimableAuthorizationsForMission } from "@/lib/earn/notify";
import { getTreasurySnapshot } from "@/lib/treasury/engine";

export type ClaimableReleaseResult = {
  releasedUsd: number;
  authorizationCount: number;
  missions: string[];
  treasuryBalanceUsd: number;
  skippedReason?: string;
};

/**
 * Move authorized rows → claimable up to treasury balance (FIFO by createdAt).
 * Recognized value can exceed treasury; only the funded slice becomes claimable.
 */
export async function releaseClaimableWithinTreasury(): Promise<ClaimableReleaseResult> {
  const snap = await getTreasurySnapshot();
  const budgetUsd = Math.max(0, snap.balanceUsd * 0.92);

  if (budgetUsd < 0.01) {
    return {
      releasedUsd: 0,
      authorizationCount: 0,
      missions: [],
      treasuryBalanceUsd: snap.balanceUsd,
      skippedReason: "treasury_empty",
    };
  }

  const existingClaimable = await prisma.paymentAuthorization.aggregate({
    where: { status: "claimable" },
    _sum: { amountUsd: true },
  });
  const alreadyClaimable = existingClaimable._sum.amountUsd ?? 0;
  let remaining = Math.max(0, budgetUsd - alreadyClaimable);

  if (remaining < 0.01) {
    return {
      releasedUsd: 0,
      authorizationCount: 0,
      missions: [],
      treasuryBalanceUsd: snap.balanceUsd,
      skippedReason: "claimable_pool_full",
    };
  }

  const rows = await prisma.paymentAuthorization.findMany({
    where: { status: "authorized" },
    orderBy: { createdAt: "asc" },
    select: { id: true, missionId: true, amountUsd: true },
  });

  const idsToRelease: string[] = [];
  const missions = new Set<string>();
  let releasedUsd = 0;

  for (const row of rows) {
    if (remaining < 0.01) break;
    if (row.amountUsd > remaining) continue;
    idsToRelease.push(row.id);
    missions.add(row.missionId);
    remaining -= row.amountUsd;
    releasedUsd += row.amountUsd;
  }

  if (!idsToRelease.length) {
    return {
      releasedUsd: 0,
      authorizationCount: 0,
      missions: [],
      treasuryBalanceUsd: snap.balanceUsd,
      skippedReason: "no_rows_fit_budget",
    };
  }

  const settlementId = `treasury-release:${Date.now()}`;
  const now = new Date();

  await prisma.paymentAuthorization.updateMany({
    where: { id: { in: idsToRelease } },
    data: {
      status: "claimable",
      settlementId,
      fulfilledAt: now,
    },
  });

  for (const missionId of missions) {
    try {
      await notifyClaimableAuthorizationsForMission(missionId);
    } catch (e) {
      console.error("[claimable-release] notify failed:", e);
    }
  }

  return {
    releasedUsd: Math.round(releasedUsd * 100) / 100,
    authorizationCount: idsToRelease.length,
    missions: [...missions],
    treasuryBalanceUsd: snap.balanceUsd,
  };
}
