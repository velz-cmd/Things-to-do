import { prisma } from "@/lib/db";
import type { User } from "@prisma/client";
import { explorerTxUrl } from "@/lib/settlement/arc-config";
import { RESOLVE_PLATFORM_WALLET } from "@/lib/payment/platform-fee";
import { circleIdempotencyKey } from "@/lib/wallet/circle-idempotency";
import { upgradeUserToCircleWallet } from "@/lib/wallet/app-wallet-service";
import { getRealSpendableUsd, syncIdentityBalance } from "@/lib/wallet/sync-identity-balance";
import {
  ARC_GAS_RESERVE_USD,
  sendUsdcFromUserCircleWallet,
} from "@/lib/wallet/circle-arc-transfer";
import { isLiveArcEnabled } from "@/lib/settlement/arc-config";

export type AgentArcPaymentResult =
  | {
      ok: true;
      txHash: string;
      explorerUrl: string;
      chargedUsd: number;
      balanceUsd: number;
      previousBalanceUsd: number;
      onChainUsd: number | null;
    }
  | { ok: false; error: string; balanceUsd: number; onChainUsd: number | null };

function round(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Debit user by sending USDC on Arc — verified on explorer before ledger update.
 * No off-chain-only charges for agent signals.
 */
export async function chargeAgentSignalOnArc(input: {
  user: User;
  amountUsd: number;
  serviceId: string;
  taskId: string;
}): Promise<AgentArcPaymentResult> {
  if (!isLiveArcEnabled()) {
    return {
      ok: false,
      error: "Live Arc settlement is not configured — cannot charge for agent signals",
      balanceUsd: 0,
      onChainUsd: null,
    };
  }

  const amount = round(input.amountUsd);
  if (amount <= 0) {
    return { ok: false, error: "Invalid signal price", balanceUsd: 0, onChainUsd: null };
  }

  let user = input.user;
  try {
    user = await upgradeUserToCircleWallet(user);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not provision Circle wallet",
      balanceUsd: user.availableUsd,
      onChainUsd: null,
    };
  }

  const spendable = await getRealSpendableUsd(user.id, { sync: true });
  const previousBalanceUsd = spendable.availableUsd;
  const maxCharge = round(Math.max(0, spendable.availableUsd - ARC_GAS_RESERVE_USD));

  if (amount > maxCharge + 0.000001) {
    return {
      ok: false,
      error:
        maxCharge <= 0
          ? "Not enough USDC on Arc — deposit USDC to your RESOLVE wallet on Arc testnet"
          : `Insufficient on-chain balance: $${spendable.availableUsd.toFixed(2)} available on Arc, need $${amount.toFixed(3)}`,
      balanceUsd: spendable.availableUsd,
      onChainUsd: spendable.onChainUsd,
    };
  }

  if (!RESOLVE_PLATFORM_WALLET) {
    return {
      ok: false,
      error: "Platform settlement wallet not configured",
      balanceUsd: spendable.availableUsd,
      onChainUsd: spendable.onChainUsd,
    };
  }

  try {
    const { txHash } = await sendUsdcFromUserCircleWallet({
      user,
      destinationAddress: RESOLVE_PLATFORM_WALLET,
      amountUsd: amount,
      idempotencyKey: circleIdempotencyKey(`agent-signal:${input.taskId}:${input.serviceId}`),
    });

    await prisma.walletTransaction.create({
      data: {
        userId: user.id,
        type: "agent_signal",
        method: "arc_usdc",
        amountUsd: -amount,
        label: `agent:${input.serviceId}:${input.taskId}:${txHash}`,
        status: "completed",
      },
    });

    await syncIdentityBalance(user.id);
    const after = await getRealSpendableUsd(user.id, { sync: true });

    return {
      ok: true,
      txHash,
      explorerUrl: explorerTxUrl(txHash),
      chargedUsd: amount,
      balanceUsd: round(after.availableUsd),
      previousBalanceUsd,
      onChainUsd: after.onChainUsd,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Arc payment failed";
    const bal = await getRealSpendableUsd(user.id);
    return {
      ok: false,
      error: message,
      balanceUsd: bal.availableUsd,
      onChainUsd: bal.onChainUsd,
    };
  }
}
