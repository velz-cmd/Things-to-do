import { isHash } from "viem";
import { prisma } from "@/lib/db";
import { fundCommunityProgram } from "@/lib/capital/fund-program";
import { recordTimelineEvent } from "@/lib/mission/server/timeline";
import { verifyArcTransferFromWallet } from "@/lib/wallet/verify-crypto-deposit";
import { resolvePaymentRoute } from "@/lib/wallet/payment-routes";

export type FundProgramWithTxResult =
  | Awaited<ReturnType<typeof fundCommunityProgram>>
  | { ok: false; error: string };

/**
 * Verify a wallet-signed Arc USDC transfer to the settlement treasury, then stake on a program.
 * Connected wallet pays treasury directly — not the user's RESOLVE identity wallet.
 */
export async function fundCommunityProgramWithTx(input: {
  userId: string;
  programId: string;
  amountUsd: number;
  txHash: string;
}): Promise<FundProgramWithTxResult> {
  if (!isHash(input.txHash)) {
    return { ok: false, error: "Invalid transaction hash" };
  }

  const profile = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      walletAddress: true,
      scanWalletAddress: true,
    },
  });

  const fromWallet = profile?.scanWalletAddress?.trim().toLowerCase();
  if (!fromWallet) {
    return {
      ok: false,
      error:
        "Connect your wallet from the account menu, then sign the Arc transfer to fund this pool",
    };
  }

  const refLabel = `fund_tx:${input.txHash.toLowerCase()}`;
  const existing = await prisma.walletTransaction.findFirst({
    where: { userId: input.userId, label: refLabel },
  });
  if (existing) {
    return { ok: false, error: "This transaction was already used to fund a pool" };
  }

  const route = resolvePaymentRoute(
    "program_fund",
    profile?.walletAddress ?? fromWallet,
  );
  if ("error" in route) {
    return { ok: false, error: route.error };
  }

  const verified = await verifyArcTransferFromWallet({
    txHash: input.txHash as `0x${string}`,
    expectedUsd: input.amountUsd,
    depositAddress: route.address,
    fromWallet,
    destinationLabel:
      route.kind === "treasury"
        ? "RESOLVE settlement treasury"
        : "your RESOLVE Arc wallet",
  });

  if (!verified.ok) {
    return { ok: false, error: verified.error };
  }

  const result = await fundCommunityProgram({
    userId: input.userId,
    programId: input.programId,
    amountUsd: input.amountUsd,
    settleFrom: "treasury_on_chain",
    txHash: input.txHash,
  });

  if (result.ok) {
    await recordTimelineEvent({
      userId: input.userId,
      eventType: "pool_funding_pending",
      title: "Pool funded on Arc",
      detail: `Verified transfer ${input.txHash.slice(0, 10)}…`,
      severity: "info",
      metadata: {
        programId: input.programId,
        activityId: result.activityId,
        amountUsd: input.amountUsd,
        txHash: input.txHash,
        fromWallet,
      },
    }).catch(() => null);

    await prisma.walletTransaction.create({
      data: {
        userId: input.userId,
        type: "adjustment",
        method: "crypto",
        amountUsd: 0,
        label: refLabel,
        status: "completed",
      },
    });
  }

  return result;
}
