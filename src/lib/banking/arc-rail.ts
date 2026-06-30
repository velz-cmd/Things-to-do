import { prisma } from "@/lib/db";
import { ARC_MEMO_CONTRACT } from "@/lib/arc/memo-abi";
import {
  ARC_CHAIN_ID,
  ARC_EXPLORER_URL,
  ARC_PROVIDER_WALLET_ADDRESS,
  ARC_USDC_CONTRACT,
} from "@/lib/settlement/arc-config";
import { getArcReadiness } from "@/lib/treasury/arc-readiness";
import { getArcUsdcBalance } from "@/lib/wallet/alchemy";
import {
  appWalletProvider,
  circleWalletIdForUser,
} from "@/lib/wallet/app-wallet-service";
import { resolveIdentityWalletAddress } from "@/lib/wallet/identity-address";
import type { User } from "@prisma/client";
import type { BankingArcRail, BankingMemoActivity } from "@/lib/banking/types";

function round(n: number) {
  return Math.round(n * 100) / 100;
}

function isRealTxHash(hash: string | null | undefined): hash is string {
  return Boolean(hash && hash.startsWith("0x") && hash.length >= 66);
}

async function getRecentMemoActivity(
  userId: string | null,
  limit = 10,
): Promise<BankingMemoActivity[]> {
  try {
    const missionIds =
      userId ?
        (
          await prisma.resolveProgram.findMany({
            where: { userId },
            select: { missionId: true },
          })
        )
          .map((p) => p.missionId)
          .filter((id): id is string => Boolean(id))
      : [];

    if (!missionIds.length) return [];

    const settlements = await prisma.missionSettlement.findMany({
      where: {
        missionId: { in: missionIds },
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
  } catch {
    return [];
  }
}

/** Safe Arc rail snapshot when DB or network is unavailable (CI, cold start). */
export function buildFallbackArcRail(): BankingArcRail {
  return {
    chain: "Arc Testnet",
    chainId: ARC_CHAIN_ID,
    currency: "USDC",
    usdcGas: true,
    live: false,
    canDistribute: false,
    blockers: [],
    message: "Account overview",
    contracts: { usdc: ARC_USDC_CONTRACT, memo: ARC_MEMO_CONTRACT },
    agentWallet: ARC_PROVIDER_WALLET_ADDRESS ?? null,
    settlementWallet: null,
    settlementBalanceUsd: null,
    explorerUrl: ARC_EXPLORER_URL,
    capabilities: {
      identityWallet: true,
      depositArcUsdc: true,
      batchMemoPayouts: true,
      agentNanoPayments: true,
      erc8183Escrow: true,
      cctpBridge: true,
    },
    stats: { nanoPaymentsSettled: 0, recentMemoCount: 0 },
    identityWallet: null,
    recentMemos: [],
  };
}

/** Circle Arc rail — USDC gas, memo payouts, agent nano-payments, one identity wallet. */
export async function getBankingArcRail(
  profile: User | null,
  opts?: { identityOnChainUsd?: number | null; light?: boolean },
): Promise<BankingArcRail> {
  try {
  const readiness =
    opts?.light ? null : await getArcReadiness();

  let identityOnChainUsd: number | null = opts?.identityOnChainUsd ?? null;
  if (identityOnChainUsd === null && profile && !opts?.light) {
    try {
      const addr = resolveIdentityWalletAddress(profile.id, profile);
      const bal = await getArcUsdcBalance(addr);
      identityOnChainUsd = round(bal.balanceUsd);
    } catch {
      identityOnChainUsd = null;
    }
  }

  const nanoCount = opts?.light
    ? 0
    : await prisma.settlementNanoPayment
        .count({ where: { status: "settled" } })
        .catch(() => 0);

  const memoActivity = opts?.light ? [] : await getRecentMemoActivity(profile?.id ?? null, 8);
  const depositAddress =
    profile ? resolveIdentityWalletAddress(profile.id, profile) : null;

  return {
    chain: "Arc Testnet",
    chainId: ARC_CHAIN_ID,
    currency: "USDC",
    usdcGas: true,
    live: readiness?.liveArc ?? false,
    canDistribute: readiness?.canDistributeOnChain ?? false,
    blockers: readiness?.blockers ?? [],
    message: readiness?.message ?? "Account overview",
    contracts: {
      usdc: ARC_USDC_CONTRACT,
      memo: ARC_MEMO_CONTRACT,
    },
    agentWallet: ARC_PROVIDER_WALLET_ADDRESS ?? null,
    settlementWallet: readiness?.clientWallet ?? null,
    settlementBalanceUsd: readiness?.balanceUsd ?? null,
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
      depositAddress ?
        {
          address: depositAddress,
          label: `${depositAddress.slice(0, 6)}…${depositAddress.slice(-4)}`,
          provider: profile ? appWalletProvider(profile) : "embedded",
          circleWalletId: profile ? circleWalletIdForUser(profile) : null,
          depositAddress,
          onChainUsdcUsd: identityOnChainUsd,
        }
      : null,
    recentMemos: memoActivity.filter((m) => isRealTxHash(m.txHash)),
  };
  } catch {
    return buildFallbackArcRail();
  }
}
