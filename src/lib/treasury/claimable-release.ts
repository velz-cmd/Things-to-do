import { prisma } from "@/lib/db";
import { notifyClaimableAuthorizationsForMission } from "@/lib/earn/notify";
import { debitStakePool, getProgramStakePool } from "@/lib/capital/yield-service";

export type ClaimableReleaseResult = {
  releasedUsd: number;
  authorizationCount: number;
  missions: string[];
  treasuryBalanceUsd: number;
  skippedReason?: string;
};

type FundingPool = {
  programId: string;
  missionId: string;
  ownerUserId: string;
  budgetUsd: number;
};

async function resolveFundingPools(): Promise<FundingPool[]> {
  const programs = await prisma.resolveProgram.findMany({
    where: { status: { in: ["active", "deployed"] }, missionId: { not: null } },
    select: {
      id: true,
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
      programId: p.id,
      missionId: p.missionId,
      ownerUserId: p.userId,
      budgetUsd: budget,
    });
  }

  return [...pools.values()];
}

/**
 * Move authorized → claimable using program capital:
 * - Community fund stakes (any funder)
 * - Program owner deposits (User.availableUsd)
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
  const stakeDebits = new Map<string, number>();
  let releasedUsd = 0;

  for (const pool of pools) {
    const owner = await prisma.user.findUnique({
      where: { id: pool.ownerUserId },
      select: { availableUsd: true },
    });
    const ownerBalance = owner?.availableUsd ?? 0;
    const stakePool = await getProgramStakePool(pool.programId);
    const depositBalance = round(ownerBalance + stakePool.availableUsd);
    if (depositBalance < 0.01) continue;

    const existingClaimable = await prisma.paymentAuthorization.aggregate({
      where: { missionId: pool.missionId, status: "claimable" },
      _sum: { amountUsd: true },
    });
    const alreadyClaimable = existingClaimable._sum.amountUsd ?? 0;

    const programCap = pool.budgetUsd > 0 ? pool.budgetUsd : depositBalance;
    let remaining = Math.max(0, Math.min(depositBalance, programCap) - alreadyClaimable);
    if (remaining < 0.01) continue;

    const rows = await prisma.paymentAuthorization.findMany({
      where: { missionId: pool.missionId, status: "authorized" },
      orderBy: { createdAt: "asc" },
      select: { id: true, missionId: true, amountUsd: true },
    });

    let missionReleaseTotal = 0;
    for (const row of rows) {
      if (remaining < 0.01) break;
      if (row.amountUsd > remaining) continue;
      idsToRelease.push(row.id);
      missions.add(row.missionId);
      remaining -= row.amountUsd;
      releasedUsd += row.amountUsd;
      missionReleaseTotal += row.amountUsd;
    }

    if (missionReleaseTotal > 0) {
      const fromStakes = Math.min(missionReleaseTotal, stakePool.availableUsd);
      const fromOwner = missionReleaseTotal - fromStakes;
      if (fromStakes > 0) {
        stakeDebits.set(
          pool.programId,
          (stakeDebits.get(pool.programId) ?? 0) + fromStakes,
        );
      }
      if (fromOwner > 0) {
        ownerDebits.set(
          pool.ownerUserId,
          (ownerDebits.get(pool.ownerUserId) ?? 0) + fromOwner,
        );
      }
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

  for (const [programId, amount] of stakeDebits.entries()) {
    await debitStakePool(programId, amount);
  }

  for (const missionId of missions) {
    try {
      await notifyClaimableAuthorizationsForMission(missionId);
    } catch (e) {
      console.error("[claimable-release] notify failed:", e);
    }
  }

  const totalDeposits = await prisma.user.aggregate({ _sum: { availableUsd: true } });

  return {
    releasedUsd: round(releasedUsd),
    authorizationCount: idsToRelease.length,
    missions: [...missions],
    treasuryBalanceUsd: totalDeposits._sum.availableUsd ?? 0,
  };
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}
