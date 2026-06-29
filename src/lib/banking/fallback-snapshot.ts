import type { BankingAccountSnapshot } from "@/lib/banking/types";
import { BANKING_POLICY } from "@/lib/banking/types";

/** Minimal Capital snapshot when the full banking route is slow or unavailable. */
export function bankingSnapshotFromWalletBalance(input: {
  userId: string;
  email?: string | null;
  displayName?: string | null;
  walletAddress?: string | null;
  availableUsd: number;
  onChainUsd?: number | null;
  reservedUsd?: number;
}): BankingAccountSnapshot {
  const wallet = input.walletAddress ?? null;
  const label = wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : null;

  return {
    ok: true,
    signedIn: true,
    accountId: input.userId,
    displayName: input.displayName ?? null,
    email: input.email ?? null,
    memberSince: new Date().toISOString(),
    walletAddress: wallet,
    walletLabel: label,
    policy: BANKING_POLICY,
    balances: {
      availableUsd: input.availableUsd,
      reservedUsd: input.reservedUsd ?? 0,
      earnedClaimableUsd: 0,
      earnedAuthorizedUsd: 0,
      earnedSettledUsd: 0,
      totalDepositedUsd: input.onChainUsd ?? input.availableUsd,
      onChainUsdcUsd: input.onChainUsd ?? null,
    },
    programs: [],
    statement: [],
    network: {
      authorizedUsd: 0,
      claimableUsd: 0,
      settledUsd: 0,
      pendingFundingUsd: 0,
    },
    arc: {
      chain: "Arc Testnet",
      chainId: 5042002,
      currency: "USDC",
      usdcGas: true,
      live: false,
      canDistribute: false,
      blockers: [],
      message: "Account overview",
      contracts: { usdc: "", memo: "" },
      agentWallet: null,
      settlementWallet: null,
      settlementBalanceUsd: null,
      explorerUrl: "https://testnet.arcscan.app",
      capabilities: {
        identityWallet: true,
        depositArcUsdc: true,
        batchMemoPayouts: true,
        agentNanoPayments: true,
        erc8183Escrow: true,
        cctpBridge: true,
      },
      stats: { nanoPaymentsSettled: 0, recentMemoCount: 0 },
      identityWallet:
        wallet ?
          {
            address: wallet,
            label: label!,
            provider: "embedded" as const,
            circleWalletId: null,
            depositAddress: wallet,
            onChainUsdcUsd: input.onChainUsd ?? null,
          }
        : null,
      recentMemos: [],
    },
    identities: {
      github: null,
      emailVerified: true,
      gmailConnected: false,
      gmailOperatorLive: false,
    },
    updatedAt: new Date().toISOString(),
  };
}
