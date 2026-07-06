import { isHash } from "viem";
import { prisma } from "@/lib/db";
import { explorerTxUrl } from "@/lib/settlement/arc-config";
import { resolvePaymentRoute } from "@/lib/wallet/payment-routes";
import { verifyArcTransferFromWallet } from "@/lib/wallet/verify-crypto-deposit";
import { syncIdentityBalance } from "@/lib/wallet/sync-identity-balance";
import type { AgentArcPaymentResult } from "@/lib/agent/agent-signal-arc-payment";

function round(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Verify a wallet-signed Arc USDC transfer for an agent signal, then record ledger debit.
 * Connected wallet pays the agent settlement address directly.
 */
export async function chargeAgentSignalWithExternalTx(input: {
  userId: string;
  amountUsd: number;
  serviceId: string;
  taskId: string;
  txHash: string;
  identityWalletAddress?: string | null;
}): Promise<AgentArcPaymentResult> {
  if (!isHash(input.txHash)) {
    return { ok: false, error: "Invalid transaction hash", balanceUsd: 0, onChainUsd: null };
  }

  const profile = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      availableUsd: true,
      walletAddress: true,
      scanWalletAddress: true,
    },
  });
  if (!profile) {
    return { ok: false, error: "Sign in again", balanceUsd: 0, onChainUsd: null };
  }

  const fromWallet = profile.scanWalletAddress?.trim().toLowerCase();
  if (!fromWallet) {
    return {
      ok: false,
      error: "Connect your wallet and sign the Arc transfer before running the agent",
      balanceUsd: profile.availableUsd,
      onChainUsd: null,
    };
  }

  const refLabel = `agent_tx:${input.serviceId}:${input.taskId}:${input.txHash.toLowerCase()}`;
  const existing = await prisma.walletTransaction.findFirst({
    where: { userId: input.userId, label: refLabel },
  });
  if (existing) {
    return {
      ok: false,
      error: "This transaction was already used for an agent signal",
      balanceUsd: profile.availableUsd,
      onChainUsd: null,
    };
  }

  const route = resolvePaymentRoute(
    "agent_signal",
    input.identityWalletAddress ?? profile.walletAddress ?? fromWallet,
  );
  if ("error" in route) {
    return { ok: false, error: route.error, balanceUsd: profile.availableUsd, onChainUsd: null };
  }

  const amount = round(input.amountUsd);
  const verified = await verifyArcTransferFromWallet({
    txHash: input.txHash as `0x${string}`,
    expectedUsd: amount,
    depositAddress: route.address,
    fromWallet,
    destinationLabel: route.label,
  });

  if (!verified.ok) {
    return {
      ok: false,
      error: verified.error,
      balanceUsd: profile.availableUsd,
      onChainUsd: null,
    };
  }

  const previousBalanceUsd = round(profile.availableUsd);

  await prisma.walletTransaction.create({
    data: {
      userId: input.userId,
      type: "agent_signal",
      method: "crypto",
      amountUsd: -amount,
      label: refLabel,
      status: "completed",
    },
  });

  await syncIdentityBalance(input.userId);
  const after = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { availableUsd: true },
  });

  return {
    ok: true,
    txHash: input.txHash,
    explorerUrl: explorerTxUrl(input.txHash),
    chargedUsd: amount,
    balanceUsd: round(after?.availableUsd ?? previousBalanceUsd),
    previousBalanceUsd,
    onChainUsd: null,
  };
}
