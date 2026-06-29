import { prisma } from "@/lib/db";
import { recordTimelineEvent } from "@/lib/mission/server/timeline";
import { refreshProgramYieldCache } from "@/lib/capital/yield-service";
import { DEFAULT_TARGET_YIELD_MULTIPLIER } from "@/lib/capital/community-yield";

const MIN_FUND_USD = 5;

export type FundProgramResult =
  | {
      ok: true;
      stakeId: string;
      programId: string;
      principalUsd: number;
      targetYieldMultiplier: number;
      newBudgetUsd: number;
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
    return { ok: false, error: `Minimum fund is $${MIN_FUND_USD}` };
  }

  const program = await prisma.resolveProgram.findUnique({
    where: { id: input.programId },
    include: { install: { select: { communitySlug: true, ecosystemId: true } } },
  });
  if (!program) return { ok: false, error: "Program not found" };
  if (!program.missionId) return { ok: false, error: "Program is not deployed yet" };
  if (!["active", "deployed"].includes(program.status)) {
    return { ok: false, error: "Program is not accepting funds" };
  }

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { availableUsd: true },
  });
  if (!user || user.availableUsd < amount) {
    return { ok: false, error: "Insufficient balance — add money first" };
  }

  const target = input.targetYieldMultiplier ?? DEFAULT_TARGET_YIELD_MULTIPLIER;

  const stake = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: input.userId },
      data: { availableUsd: { decrement: amount } },
    });

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

    await tx.walletTransaction.create({
      data: {
        userId: input.userId,
        type: "distribution",
        amountUsd: -amount,
        label: `fund:program:${program.id}`,
        status: "completed",
      },
    });

    return row;
  });

  await recordTimelineEvent({
    userId: input.userId,
    ecosystemId: program.install?.ecosystemId ?? undefined,
    eventType: "community_funded",
    title: `Funded ${program.name}`,
    detail: `Staked $${amount.toFixed(2)} — target ${target}× verified impact`,
    severity: "info",
    metadata: { programId: program.id, stakeId: stake.id, amountUsd: amount },
  }).catch(() => {});

  await refreshProgramYieldCache(program.id);

  return {
    ok: true,
    stakeId: stake.id,
    programId: program.id,
    principalUsd: amount,
    targetYieldMultiplier: target,
    newBudgetUsd: program.budgetUsd + amount,
  };
}
