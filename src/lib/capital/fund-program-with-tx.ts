import { isHash } from "viem";
import { prisma } from "@/lib/db";
import { fundCommunityProgram } from "@/lib/capital/fund-program";
import { verifyArcTransferFromWallet } from "@/lib/wallet/verify-crypto-deposit";

export type FundProgramWithTxResult =
  | Awaited<ReturnType<typeof fundCommunityProgram>>
  | { ok: false; error: string };

/**
 * Credit a wallet-signed Arc USDC transfer, then stake on a community program.
 * One on-chain signature from the user's linked external wallet.
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
      availableUsd: true,
    },
  });

  if (!profile?.walletAddress) {
    return { ok: false, error: "RESOLVE wallet not ready — try again in a moment" };
  }

  const fromWallet = profile.scanWalletAddress?.trim().toLowerCase();
  if (!fromWallet) {
    return {
      ok: false,
      error: "Connect your wallet in the account menu before funding on-chain",
    };
  }

  const refLabel = `fund_tx:${input.txHash.toLowerCase()}`;
  const existing = await prisma.walletTransaction.findFirst({
    where: { userId: input.userId, label: refLabel },
  });
  if (existing) {
    return { ok: false, error: "This transaction was already used to fund a pool" };
  }

  const verified = await verifyArcTransferFromWallet({
    txHash: input.txHash as `0x${string}`,
    expectedUsd: input.amountUsd,
    depositAddress: profile.walletAddress,
    fromWallet,
  });

  if (!verified.ok) {
    return { ok: false, error: verified.error };
  }

  const credit = Math.round(verified.amountUsd * 100) / 100;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: input.userId },
      data: { availableUsd: { increment: credit } },
    }),
    prisma.walletTransaction.create({
      data: {
        userId: input.userId,
        type: "deposit",
        method: "crypto",
        amountUsd: credit,
        label: refLabel,
        status: "completed",
      },
    }),
  ]);

  return fundCommunityProgram({
    userId: input.userId,
    programId: input.programId,
    amountUsd: input.amountUsd,
  });
}
