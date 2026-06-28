import { prisma } from "@/lib/db";
import { ARC_MEMO_CONTRACT } from "@/lib/arc/memo-abi";
import {
  ARC_CHAIN_ID,
  ARC_EXPLORER_URL,
  ARC_PROVIDER_WALLET_ADDRESS,
  ARC_USDC_CONTRACT,
} from "@/lib/settlement/arc-config";
import { getArcReadiness } from "@/lib/treasury/arc-readiness";
import { getArcUsdcBalance, isAlchemyConfigured } from "@/lib/wallet/alchemy";
import {
  appWalletProvider,
  circleWalletIdForUser,
} from "@/lib/wallet/app-wallet-service";
import type { User } from "@prisma/client";
import type { BankingArcRail, BankingMemoActivity } from "@/lib/banking/types";

function round(n: number) {
  return Math.round(n * 100) / 100;
}

function isRealTxHash(hash: string | null | undefined): hash is string {
  return Boolean(hash && hash.startsWith("0x") && hash.length >= 66);
}

async function getRecentMemoActivity(limit = 10): Promise<BankingMemoActivity[]> {
  const settlements = await prisma.missionSettlement.findMany({
    where: {
      escrowTxHash: { startsWith: "0x" },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      missionId: true,
      repo: true,
      treasuryAmount: true,
      escrowTxHash: true,
      status: true,
      updatedAt: true,
      batchNumber: true,
    },
  });

  return settlements.map((s) => ({
    id: s.id,
    at: s.updatedAt.toISOString(),
    kind: "batch_memo" as const,
    amountUsd: round(s.treasuryAmount),
    txHash: s.escrowTxHash!,
    label: s.repo ?? s.missionId,
    batchNumber: s.batchNumber,
  }));
}

/** Circle Arc rail — USDC gas, memo payouts, agent nano-payments, one identity wallet. */
export async function getBankingArcRail(profile: User | null): Promise<BankingArcRail> {
  const readiness = await getArcReadiness();

  let identityOnChainUsd: number | null = null;
  if (profile?.walletAddress && isAlchemyConfigured()) {
    try {
      const bal = await getArcUsdcBalance(profile.walletAddress);
      identityOnChainUsd = round(bal.balanceUsd);
    } catch {
      identityOnChainUsd = null;
    }
  }

  const nanoCount = await prisma.settlementNanoPayment.count({
    where: { status: "settled" },
  });

  const memoActivity = await getRecentMemoActivity(8);

  return {
    chain: "Arc Testnet",
    chainId: ARC_CHAIN_ID,
    currency: "USDC",
    usdcGas: true,
    live: readiness.liveArc,
    canDistribute: readiness.canDistributeOnChain,
    blockers: readiness.blockers,
    message: readiness.message,
    contracts: {
      usdc: ARC_USDC_CONTRACT,
      memo: ARC_MEMO_CONTRACT,
    },
    agentWallet: ARC_PROVIDER_WALLET_ADDRESS ?? null,
    settlementWallet: readiness.clientWallet,
    settlementBalanceUsd: readiness.balanceUsd,
    explorerUrl: ARC_EXPLORER_URL,
    capabilities: {
      identityWallet: true,
      depositArcUsdc: true,
      batchMemoPayouts: true,
      agentNanoPayments: true,
      erc8183Escrow: true,
      cctpBridge: true,
    },
    stats: {
      nanoPaymentsSettled: nanoCount,
      recentMemoCount: memoActivity.length,
    },
    identityWallet:
      profile?.walletAddress ?
        {
          address: profile.walletAddress,
          label: `${profile.walletAddress.slice(0, 6)}…${profile.walletAddress.slice(-4)}`,
          provider: appWalletProvider(profile),
          circleWalletId: circleWalletIdForUser(profile),
          depositAddress: profile.walletAddress,
          onChainUsdcUsd: identityOnChainUsd,
        }
      : null,
    recentMemos: memoActivity.filter((m) => isRealTxHash(m.txHash)),
  };
}
