import { prisma } from "@/lib/db";
import {
  circleClientForTransfers,
  getCircleArcTransferSnapshot,
  waitForCircleArcTransfer,
} from "@/lib/wallet/circle-arc-transfer";
import {
  activityLabelWithCircleTx,
  circleTxIdFromActivityLabel,
  stakeIdFromActivityLabel,
} from "@/lib/capital/fund-pending-label";
import { syncSupporterBenefitsForStake } from "@/lib/capital/supporter-benefits";

export type FinalizeFundResult =
  | { ok: true; status: "completed"; activityId: string; txHash?: string }
  | { ok: true; status: "pending_arc"; activityId: string; message: string }
  | { ok: true; status: "reversed"; activityId: string; message: string }
  | { ok: false; error: string };

async function reverseFundStake(input: {
  userId: string;
  programId: string;
  stakeId: string;
  activityId: string;
  amount: number;
  programName: string;
  reason: string;
}) {
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: input.userId },
      data: { availableUsd: { increment: input.amount } },
    });
    await tx.resolveProgram.update({
      where: { id: input.programId },
      data: { budgetUsd: { decrement: input.amount } },
    });
    await tx.communityFundStake.delete({ where: { id: input.stakeId } });
    await tx.walletTransaction.update({
      where: { id: input.activityId },
      data: {
        status: "failed",
        label: `${input.reason} — ${input.programName}`,
      },
    });
  });
}

/** Complete or reverse a single pending Arc fund using Circle transfer state. */
export async function finalizePendingFundActivity(input: {
  userId: string;
  activityId: string;
  waitMs?: number;
}): Promise<FinalizeFundResult> {
  const activity = await prisma.walletTransaction.findFirst({
    where: { id: input.activityId, userId: input.userId, type: "fund_program" },
  });
  if (!activity) {
    return { ok: false, error: "Fund activity not found" };
  }

  if (activity.status === "completed") {
    return { ok: true, status: "completed", activityId: activity.id };
  }
  if (activity.status === "failed") {
    return { ok: false, error: "This fund was reversed — your balance was restored" };
  }

  const circleTransactionId = circleTxIdFromActivityLabel(activity.label);
  if (!circleTransactionId) {
    return { ok: false, error: "Pending fund is missing Arc transfer reference" };
  }

  const stakeIdFromLabel = stakeIdFromActivityLabel(activity.label);
  const stakeRow = stakeIdFromLabel
    ? await prisma.communityFundStake.findFirst({
        where: { id: stakeIdFromLabel, userId: input.userId },
        include: { program: { select: { id: true, name: true } } },
      })
    : await prisma.communityFundStake.findFirst({
        where: { userId: input.userId, status: "pending_arc" },
        orderBy: { createdAt: "desc" },
        include: { program: { select: { id: true, name: true } } },
      });

  if (!stakeRow) {
    return { ok: false, error: "Pending pool stake not found" };
  }

  const amount = Math.abs(activity.amountUsd);
  const circle = await circleClientForTransfers();

  let snapshot = await getCircleArcTransferSnapshot(circle, circleTransactionId);

  if (snapshot.state === "pending" && (input.waitMs ?? 0) > 0) {
    const waitMs = input.waitMs ?? 0;
    try {
      const waited = await waitForCircleArcTransfer(circle, circleTransactionId, {
        maxAttempts: Math.max(1, Math.ceil(waitMs / 1500)),
      });
      snapshot = { state: "complete", txHash: waited.txHash };
    } catch {
      snapshot = await getCircleArcTransferSnapshot(circle, circleTransactionId);
    }
  }

  if (snapshot.state === "complete" && snapshot.txHash) {
    await prisma.$transaction(async (tx) => {
      await tx.communityFundStake.update({
        where: { id: stakeRow.id },
        data: { status: "active" },
      });
      await tx.walletTransaction.update({
        where: { id: activity.id },
        data: {
          status: "completed",
          method: "arc_usdc",
          label: `You funded ${stakeRow.program.name} · ${snapshot.txHash}`,
        },
      });
    });
    await syncSupporterBenefitsForStake(stakeRow.id).catch((error) => {
      console.error("[fund-finalize] supporter benefit ledger sync failed", error);
    });
    return {
      ok: true,
      status: "completed",
      activityId: activity.id,
      txHash: snapshot.txHash,
    };
  }

  if (snapshot.state === "failed") {
    await reverseFundStake({
      userId: input.userId,
      programId: stakeRow.programId,
      stakeId: stakeRow.id,
      activityId: activity.id,
      amount,
      programName: stakeRow.program.name,
      reason: "Arc transfer failed",
    });
    return {
      ok: true,
      status: "reversed",
      activityId: activity.id,
      message: "Arc transfer failed — your RESOLVE balance was restored.",
    };
  }

  return {
    ok: true,
    status: "pending_arc",
    activityId: activity.id,
    message: "Arc is still confirming your transfer. No extra charge until it completes.",
  };
}

/** Best-effort finalize all pending Arc funds for a user (Capital tab recovery). */
export async function finalizeAllPendingArcFundsForUser(userId: string): Promise<number> {
  const pending = await prisma.walletTransaction.findMany({
    where: {
      userId,
      type: "fund_program",
      status: "pending",
    },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true },
  });

  let resolved = 0;
  for (const row of pending) {
    const result = await finalizePendingFundActivity({
      userId,
      activityId: row.id,
      waitMs: 4_500,
    }).catch(() => null);
    if (result?.ok && (result.status === "completed" || result.status === "reversed")) {
      resolved += 1;
    }
  }
  return resolved;
}

export async function markFundPendingArc(input: {
  stakeId: string;
  activityId: string;
  programName: string;
  circleTransactionId: string;
}) {
  const label = activityLabelWithCircleTx(
    `You funded ${input.programName}`,
    input.circleTransactionId,
    input.stakeId,
  );
  await prisma.$transaction([
    prisma.communityFundStake.update({
      where: { id: input.stakeId },
      data: { status: "pending_arc" },
    }),
    prisma.walletTransaction.update({
      where: { id: input.activityId },
      data: { status: "pending", label },
    }),
  ]);
}
