import { prisma } from "@/lib/db";
import { notifyClaimableAuthorizationsForMission } from "@/lib/earn/notify";

export type ClaimableReleaseResult = {
  releasedUsd: number;
  authorizationCount: number;
  missions: string[];
  treasuryBalanceUsd: number;
  skippedReason?: string;
};

type FundingPool = {
  missionId: string;
  ownerUserId: string;
  budgetUsd: number;
};

/** Resolve program owner + mission scope for funding (deposits, not platform agent wallet). */
async function resolveFundingPools(): Promise<FundingPool[]> {
  const programs = await prisma.resolveProgram.findMany({
    where: { status: { in: ["active", "deployed"] }, missionId: { not: null } },
    select: {
      missionId: true,
      budgetUsd: true,
      userId: true,
    },
  });

  const pools = new Map<string, FundingPool>();
  for (const p of programs) {
    if (!p.missionId) continue;
    const existing = pools.get(p.missionId);
    const budget = Math.max(p.budgetUsd, existing?.budgetUsd ?? 0);
    pools.set(p.missionId, {
      missionId: p.missionId,
      ownerUserId: p.userId,
      budgetUsd: budget,
    });
  }

  return [...pools.values()];
}

/**
 * Move authorized → claimable using **program owner deposits** (User.availableUsd).
 * Platform ARC wallet is settlement rail only — never the funding source for claims.
 */
export async function releaseClaimableWithinTreasury(): Promise<ClaimableReleaseResult> {
  const pools = await resolveFundingPools();
  if (!pools.length) {
    return {
      releasedUsd: 0,
      authorizationCount: 0,
      missions: [],
      treasuryBalanceUsd: 0,
      skippedReason: "no_active_programs",
    };
  }

  const idsToRelease: string[] = [];
  const missions = new Set<string>();
  const ownerDebits = new Map<string, number>();
  let releasedUsd = 0;

  for (const pool of pools) {
    const owner = await prisma.user.findUnique({
      where: { id: pool.ownerUserId },
      select: { availableUsd: true },
    });
    const depositBalance = owner?.availableUsd ?? 0;
    if (depositBalance < 0.01) continue;

    const existingClaimable = await prisma.paymentAuthorization.aggregate({
      where: { missionId: pool.missionId, status: "claimable" },
      _sum: { amountUsd: true },
    });
    const alreadyClaimable = existingClaimable._sum.amountUsd ?? 0;

    const programCap = pool.budgetUsd > 0 ? pool.budgetUsd : depositBalance;
    let remaining = Math.max(
      0,
      Math.min(depositBalance, programCap) - alreadyClaimable,
    );
    if (remaining < 0.01) continue;

    const rows = await prisma.paymentAuthorization.findMany({
      where: { missionId: pool.missionId, status: "authorized" },
      orderBy: { createdAt: "asc" },
      select: { id: true, missionId: true, amountUsd: true },
    });

    for (const row of rows) {
      if (remaining < 0.01) break;
      if (row.amountUsd > remaining) continue;
      idsToRelease.push(row.id);
      missions.add(row.missionId);
      remaining -= row.amountUsd;
      releasedUsd += row.amountUsd;
      ownerDebits.set(
        pool.ownerUserId,
        (ownerDebits.get(pool.ownerUserId) ?? 0) + row.amountUsd,
      );
    }
  }

  if (!idsToRelease.length) {
    const totalDeposits = await prisma.user.aggregate({ _sum: { availableUsd: true } });
    return {
      releasedUsd: 0,
      authorizationCount: 0,
      missions: [],
      treasuryBalanceUsd: totalDeposits._sum.availableUsd ?? 0,
      skippedReason: "awaiting_program_deposits",
    };
  }

  const settlementId = `deposit-release:${Date.now()}`;
  const now = new Date();

  await prisma.$transaction([
    prisma.paymentAuthorization.updateMany({
      where: { id: { in: idsToRelease } },
      data: {
        status: "claimable",
        settlementId,
        fulfilledAt: now,
      },
    }),
    ...[...ownerDebits.entries()].map(([userId, amount]) =>
      prisma.user.update({
        where: { id: userId },
        data: { availableUsd: { decrement: amount } },
      }),
    ),
  ]);

  for (const missionId of missions) {
    try {
      await notifyClaimableAuthorizationsForMission(missionId);
    } catch (e) {
      console.error("[claimable-release] notify failed:", e);
    }
  }

  const totalDeposits = await prisma.user.aggregate({ _sum: { availableUsd: true } });

  return {
    releasedUsd: Math.round(releasedUsd * 100) / 100,
    authorizationCount: idsToRelease.length,
    missions: [...missions],
    treasuryBalanceUsd: totalDeposits._sum.availableUsd ?? 0,
  };
}
