import { prisma } from "@/lib/db";
import { recordTimelineEvent } from "@/lib/mission/server/timeline";
import { refreshProgramYieldCache } from "@/lib/capital/yield-service";
import { runQfMatchAllocation } from "@/lib/capital/qf-allocator";
import { DEFAULT_TARGET_YIELD_MULTIPLIER } from "@/lib/capital/community-yield";
import { getRealSpendableUsd } from "@/lib/wallet/sync-identity-balance";
import { withProviderTimeout } from "@/lib/providers/provider-router";
import type { ProgramRules } from "@/lib/communities/types";

const MIN_FUND_USD = 5;

export type FundProgramResult =
  | {
      ok: true;
      stakeId: string;
      programId: string;
      principalUsd: number;
      targetYieldMultiplier: number;
      newBudgetUsd: number;
      status: "completed";
      activityId: string;
      message: string;
    }
  | { ok: false; error: string };

/** Any signed-in user can stake capital on a public program */
export async function fundCommunityProgram(input: {
  userId: string;
  programId: string;
  amountUsd: number;
  targetYieldMultiplier?: number;
}): Promise<FundProgramResult> {
  const amount = Math.round(input.amountUsd * 100) / 100;
  if (amount < MIN_FUND_USD) {
    return { ok: false, error: "Amount can't be less than $5" };
  }

  const program = await prisma.resolveProgram.findUnique({
    where: { id: input.programId },
    include: { install: { select: { communitySlug: true, ecosystemId: true } } },
  });
  if (!program) return { ok: false, error: "Program not found" };
  if (!program.missionId) {
    await prisma.resolveProgram.update({
      where: { id: program.id },
      data: { missionId: `program-${crypto.randomUUID().slice(0, 12)}` },
    });
  }

  let programStatus = program.status;
  if (programStatus === "draft") {
    await prisma.resolveProgram.update({
      where: { id: program.id },
      data: { status: "active" },
    });
    programStatus = "active";
  }

  if (!["active", "deployed"].includes(programStatus)) {
    return { ok: false, error: "Program is not accepting funds" };
  }

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { availableUsd: true },
  });
  if (!user) {
    return { ok: false, error: "Sign in again before funding this pool" };
  }

  let availableUsd = Math.round(user.availableUsd * 100) / 100;
  if (availableUsd < amount) {
    const synced = await withProviderTimeout(
      getRealSpendableUsd(input.userId, { sync: false }),
      1_500,
      "fund_program:wallet_read",
    ).catch(() => null);
    if (synced) {
      availableUsd = Math.max(availableUsd, Math.round(synced.availableUsd * 100) / 100);
    }
  }
  if (availableUsd < amount) {
    return {
      ok: false,
      error:
        availableUsd <= 0
          ? "Wallet has no spendable USDC. Open Capital to add funds."
          : `Insufficient balance: $${availableUsd.toFixed(2)} spendable, need $${amount.toFixed(2)}`,
    };
  }

  const target = input.targetYieldMultiplier ?? DEFAULT_TARGET_YIELD_MULTIPLIER;

  const funded = await prisma.$transaction(async (tx) => {
    const debited = await tx.user.updateMany({
      where: { id: input.userId, availableUsd: { gte: amount } },
      data: { availableUsd: { decrement: amount } },
    });
    if (debited.count === 0) {
      throw new Error("funding_balance_changed");
    }

    const row = await tx.communityFundStake.create({
      data: {
        programId: program.id,
        userId: input.userId,
        principalUsd: amount,
        targetYieldMultiplier: target,
        status: "active",
      },
    });

    await tx.resolveProgram.update({
      where: { id: program.id },
      data: { budgetUsd: { increment: amount } },
    });

    const activity = await tx.walletTransaction.create({
      data: {
        userId: input.userId,
        type: "fund_program",
        method: "arc_usdc",
        amountUsd: -amount,
        label: `You funded ${program.name}`,
        status: "completed",
      },
    });

    return { stake: row, activity };
  }).catch((error) => {
    if (error instanceof Error && error.message === "funding_balance_changed") {
      return null;
    }
    throw error;
  });
  if (!funded) {
    return {
      ok: false,
      error: "Balance changed while funding. Refresh Capital and try again.",
    };
  }

  void recordTimelineEvent({
    userId: input.userId,
    ecosystemId: program.install?.ecosystemId ?? undefined,
    eventType: "pool_funding_pending",
    title: `You funded ${program.name}`,
    detail: `You funded this pool $${amount.toFixed(2)}.`,
    severity: "info",
    metadata: {
      programId: program.id,
      stakeId: funded.stake.id,
      activityId: funded.activity.id,
      amountUsd: amount,
    },
  }).catch(() => {});

  void refreshProgramYieldCache(program.id).catch(() => undefined);

  if (program.templateId === "quadratic-funding" && program.missionId) {
    let rules: ProgramRules = {};
    try {
      rules = JSON.parse(program.rulesJson) as ProgramRules;
    } catch {
      /* defaults */
    }
    void runQfMatchAllocation({
      programId: program.id,
      missionId: program.missionId,
      rules,
      founderUserId: input.userId,
    }).catch(() => undefined);
  }

  return {
    ok: true,
    stakeId: funded.stake.id,
    programId: program.id,
    principalUsd: amount,
    targetYieldMultiplier: target,
    newBudgetUsd: program.budgetUsd + amount,
    status: "completed",
    activityId: funded.activity.id,
    message: `You funded this pool $${amount.toFixed(2)}.`,
  };
}
