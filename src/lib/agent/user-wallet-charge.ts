import { prisma } from "@/lib/db";
import { getRealSpendableUsd } from "@/lib/wallet/sync-identity-balance";

export type AgentWalletChargeResult =
  | {
      ok: true;
      chargedUsd: number;
      balanceUsd: number;
      previousBalanceUsd: number;
    }
  | { ok: false; error: string; balanceUsd: number };

/** Debit the user's Capital wallet for a completed agent signal. */
export async function chargeUserForAgentSignal(input: {
  userId: string;
  amountUsd: number;
  serviceId: string;
  serviceName: string;
  taskId: string;
  authorizationId?: string | null;
}): Promise<AgentWalletChargeResult> {
  const amount = Math.round(input.amountUsd * 10000) / 10000;
  if (amount <= 0) {
    const bal = await getRealSpendableUsd(input.userId);
    return { ok: true, chargedUsd: 0, balanceUsd: bal.availableUsd, previousBalanceUsd: bal.availableUsd };
  }

  const spendable = await getRealSpendableUsd(input.userId, { sync: true });
  if (spendable.availableUsd < amount) {
    return {
      ok: false,
      error:
        spendable.availableUsd <= 0
          ? "No spendable USDC — add funds in Capital before running agents"
          : `Insufficient balance: $${spendable.availableUsd.toFixed(2)} available, need $${amount.toFixed(2)}`,
      balanceUsd: spendable.availableUsd,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { availableUsd: true },
  });
  if (!user || user.availableUsd < amount) {
    return {
      ok: false,
      error: "Wallet sync in progress — refresh Capital and try again",
      balanceUsd: spendable.availableUsd,
    };
  }

  const previousBalanceUsd = spendable.availableUsd;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: input.userId },
      data: { availableUsd: { decrement: amount } },
    });

    await tx.walletTransaction.create({
      data: {
        userId: input.userId,
        type: "agent_signal",
        amountUsd: -amount,
        label: `agent:${input.serviceId}:${input.taskId}`,
        status: "completed",
        method: input.authorizationId ? "ledger" : "metered",
      },
    });
  });

  const after = await getRealSpendableUsd(input.userId);
  return {
    ok: true,
    chargedUsd: amount,
    balanceUsd: after.availableUsd,
    previousBalanceUsd,
  };
}

export async function assertAgentWalletBalance(
  userId: string,
  amountUsd: number,
): Promise<AgentWalletChargeResult | { ok: true; balanceUsd: number }> {
  const spendable = await getRealSpendableUsd(userId, { sync: true });
  if (spendable.availableUsd < amountUsd) {
    return {
      ok: false,
      error:
        spendable.availableUsd <= 0
          ? "No spendable USDC — add funds in Capital before running agents"
          : `Insufficient balance: $${spendable.availableUsd.toFixed(2)} available, need $${amountUsd.toFixed(2)}`,
      balanceUsd: spendable.availableUsd,
    };
  }
  return { ok: true, balanceUsd: spendable.availableUsd };
}
