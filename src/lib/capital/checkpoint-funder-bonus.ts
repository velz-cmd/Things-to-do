import { prisma } from "@/lib/db";

function round(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Micro-bonus to funders when a pool checkpoint batch settles.
 * Bonus pool = 1% of checkpoint threshold (min $0.50, max $5), split by stake share.
 */
export async function distributeCheckpointFunderBonus(input: {
  programId: string;
  thresholdUsd: number;
  settlementId?: string;
}): Promise<{ totalBonusUsd: number; creditedFunders: number }> {
  const stakes = await prisma.communityFundStake.findMany({
    where: { programId: input.programId, status: { in: ["active", "target_met"] } },
    select: { userId: true, principalUsd: true },
  });
  if (!stakes.length) return { totalBonusUsd: 0, creditedFunders: 0 };

  const totalStake = stakes.reduce((s, r) => s + r.principalUsd, 0);
  if (totalStake <= 0) return { totalBonusUsd: 0, creditedFunders: 0 };

  const bonusPool = round(Math.min(5, Math.max(0.5, input.thresholdUsd * 0.01)));
  let creditedFunders = 0;
  let totalBonusUsd = 0;

  for (const stake of stakes) {
    const share = stake.principalUsd / totalStake;
    const bonusUsd = round(bonusPool * share);
    if (bonusUsd < 0.01) continue;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: stake.userId },
        data: { availableUsd: { increment: bonusUsd } },
      }),
      prisma.walletTransaction.create({
        data: {
          userId: stake.userId,
          type: "checkpoint_bonus",
          method: "ledger_credit",
          amountUsd: bonusUsd,
          label: `Checkpoint $${input.thresholdUsd.toFixed(0)} bonus`,
          status: "completed",
        },
      }),
    ]);

    creditedFunders += 1;
    totalBonusUsd = round(totalBonusUsd + bonusUsd);
  }

  if (totalBonusUsd > 0) {
    console.info(
      `[checkpoint-bonus] program=${input.programId} threshold=$${input.thresholdUsd} bonus=$${totalBonusUsd} funders=${creditedFunders} settlement=${input.settlementId ?? "—"}`,
    );
  }

  return { totalBonusUsd, creditedFunders };
}
