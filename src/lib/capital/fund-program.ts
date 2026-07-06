import { prisma } from "@/lib/db";
import { recordTimelineEvent } from "@/lib/mission/server/timeline";
import { refreshProgramYieldCache } from "@/lib/capital/yield-service";
import { runQfMatchAllocation } from "@/lib/capital/qf-allocator";
import { DEFAULT_TARGET_YIELD_MULTIPLIER } from "@/lib/capital/community-yield";
import { getRealSpendableUsd } from "@/lib/wallet/sync-identity-balance";
import { withProviderTimeout } from "@/lib/providers/provider-router";
import {
  ARC_CLIENT_WALLET_ADDRESS,
  isLiveArcEnabled,
} from "@/lib/settlement/arc-config";
import { sendUsdcFromUserCircleWallet } from "@/lib/wallet/circle-arc-transfer";
import { circleIdempotencyKey } from "@/lib/wallet/circle-idempotency";
import type { ProgramRules } from "@/lib/communities/types";
import { isDeputyDemoMode, isProductionDeploy } from "@/lib/config/demo-mode";

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
      /** On-chain Arc tx hash when USDC moved from the funder's wallet */
      txHash?: string;
      message: string;
    }
  | { ok: false; error: string };

/** Any signed-in user can stake capital on a public program */
export async function fundCommunityProgram(input: {
  userId: string;
  programId: string;
  amountUsd: number;
  targetYieldMultiplier?: number;
  /** Ledger debit (RESOLVE app wallet). Skip when USDC already arrived at treasury on-chain. */
  settleFrom?: "ledger" | "treasury_on_chain";
  txHash?: string;
}): Promise<FundProgramResult> {
  const amount = Math.round(input.amountUsd * 100) / 100;
  const settleFrom = input.settleFrom ?? "ledger";
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
    select: { availableUsd: true, walletAddress: true },
  });
  if (!user) {
    return { ok: false, error: "Sign in again before funding this pool" };
  }

  if (settleFrom === "ledger" && !user.walletAddress) {
    return {
      ok: false,
      error:
        "RESOLVE wallet is still provisioning. Connect an external wallet with USDC on Arc to fund now.",
    };
  }

  if (settleFrom === "ledger") {
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
            ? "No spendable USDC in your RESOLVE wallet. Connect an external wallet with Arc USDC, or add funds in Capital."
            : `Insufficient RESOLVE wallet balance: $${availableUsd.toFixed(2)} spendable, need $${amount.toFixed(2)}. Try your connected wallet if it has USDC.`,
      };
    }

    if (!isLiveArcEnabled() && isProductionDeploy() && !isDeputyDemoMode()) {
      return {
        ok: false,
        error:
          "Production funding requires a live Arc USDC transfer. Connect an external wallet with USDC in Profile, or use Capital after Arc/Circle is provisioned for your RESOLVE wallet.",
      };
    }
  }

  const target = input.targetYieldMultiplier ?? DEFAULT_TARGET_YIELD_MULTIPLIER;

  const funded = await prisma.$transaction(async (tx) => {
    if (settleFrom === "ledger") {
      const debited = await tx.user.updateMany({
        where: { id: input.userId, availableUsd: { gte: amount } },
        data: { availableUsd: { decrement: amount } },
      });
      if (debited.count === 0) {
        throw new Error("funding_balance_changed");
      }
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
        method: settleFrom === "treasury_on_chain" ? "crypto" : "arc_usdc",
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

  let arcTxHash: string | undefined = input.txHash;

  if (
    settleFrom === "ledger" &&
    isLiveArcEnabled() &&
    ARC_CLIENT_WALLET_ADDRESS &&
    user.walletAddress
  ) {
    const fullUser = await prisma.user.findUnique({ where: { id: input.userId } });
    if (!fullUser) {
      return { ok: false, error: "Sign in again before funding this pool" };
    }

    try {
      const sent = await sendUsdcFromUserCircleWallet({
        user: fullUser,
        destinationAddress: ARC_CLIENT_WALLET_ADDRESS,
        amountUsd: amount,
        idempotencyKey: circleIdempotencyKey(`fund-treasury:${funded.activity.id}`),
      });
      arcTxHash = sent.txHash;
      await prisma.walletTransaction.update({
        where: { id: funded.activity.id },
        data: { status: "completed", method: "arc_usdc" },
      });
    } catch (e) {
      console.error("[fund-program] Arc treasury transfer failed — reversing stake", e);
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: input.userId },
          data: { availableUsd: { increment: amount } },
        });
        await tx.resolveProgram.update({
          where: { id: program.id },
          data: { budgetUsd: { decrement: amount } },
        });
        await tx.communityFundStake.delete({ where: { id: funded.stake.id } });
        await tx.walletTransaction.update({
          where: { id: funded.activity.id },
          data: {
            status: "failed",
            label: `Arc transfer failed — ${program.name}`,
          },
        });
      });
      return {
        ok: false,
        error:
          e instanceof Error
            ? `${e.message} — try funding with your connected wallet instead`
            : "Arc transfer failed — try your connected wallet, or add USDC to your RESOLVE wallet",
      };
    }
  }

  void recordTimelineEvent({
    userId: input.userId,
    ecosystemId: program.install?.ecosystemId ?? undefined,
    eventType: "pool_funding_pending",
    title: `You funded ${program.name}`,
    detail: arcTxHash
      ? `You funded this pool $${amount.toFixed(2)} · verified on Arc.`
      : `You funded this pool $${amount.toFixed(2)}.`,
    severity: "info",
    metadata: {
      programId: program.id,
      stakeId: funded.stake.id,
      activityId: funded.activity.id,
      amountUsd: amount,
      txHash: arcTxHash,
      fromWallet: user.walletAddress,
    },
  }).catch(() => {});

  void refreshProgramYieldCache(program.id).catch(() => undefined);

  void import("@/lib/capital/checkpoint-settle").then((m) =>
    m.tryCheckpointBatchSettle(input.userId, program.id).catch(() => null),
  );

  void import("@/lib/capital/deliver-funder-intel").then((m) =>
    m
      .deliverFunderIntelBrief({
        userId: input.userId,
        programId: program.id,
        stakeUsd: amount,
        trigger: "fund",
      })
      .catch(() => null),
  );

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
    txHash: arcTxHash,
    message: arcTxHash
      ? `You funded this pool $${amount.toFixed(2)} — verified on Arc testnet.`
      : `You funded this pool $${amount.toFixed(2)}.`,
  };
}
