import type { BankingAccountSnapshot, BankingArcRail } from "@/lib/banking/types";
import { BANKING_POLICY } from "@/lib/banking/types";

/** Client-safe Arc rail defaults — no server imports. */
const CLIENT_ARC_DEFAULTS: BankingArcRail = {
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
  identityWallet: null,
  recentMemos: [],
};

/** Ensure API / degraded responses never crash Capital UI. */
export function normalizeArcRail(arc: Partial<BankingArcRail> | null | undefined): BankingArcRail {
  if (!arc) return { ...CLIENT_ARC_DEFAULTS };
  return {
    ...CLIENT_ARC_DEFAULTS,
    ...arc,
    contracts: { ...CLIENT_ARC_DEFAULTS.contracts, ...arc.contracts },
    capabilities: { ...CLIENT_ARC_DEFAULTS.capabilities, ...arc.capabilities },
    stats: { ...CLIENT_ARC_DEFAULTS.stats, ...arc.stats },
    blockers: arc.blockers ?? CLIENT_ARC_DEFAULTS.blockers,
    recentMemos: arc.recentMemos ?? CLIENT_ARC_DEFAULTS.recentMemos,
    identityWallet: arc.identityWallet ?? CLIENT_ARC_DEFAULTS.identityWallet,
  };
}

export function normalizeBankingSnapshot(
  raw: Partial<BankingAccountSnapshot> | null | undefined,
): BankingAccountSnapshot | null {
  if (!raw || raw.signedIn === false) return null;

  const arc = normalizeArcRail(raw.arc);

  return {
    ok: true,
    signedIn: Boolean(raw.signedIn),
    accountId: raw.accountId ?? null,
    displayName: raw.displayName ?? null,
    email: raw.email ?? null,
    memberSince: raw.memberSince ?? null,
    walletAddress: raw.walletAddress ?? arc.identityWallet?.address ?? null,
    walletLabel: raw.walletLabel ?? null,
    policy: raw.policy ?? BANKING_POLICY,
    balances: {
      availableUsd: raw.balances?.availableUsd ?? 0,
      reservedUsd: raw.balances?.reservedUsd ?? 0,
      earnedClaimableUsd: raw.balances?.earnedClaimableUsd ?? 0,
      earnedAuthorizedUsd: raw.balances?.earnedAuthorizedUsd ?? 0,
      earnedSettledUsd: raw.balances?.earnedSettledUsd ?? 0,
      totalDepositedUsd: raw.balances?.totalDepositedUsd ?? 0,
      onChainUsdcUsd: raw.balances?.onChainUsdcUsd ?? arc.identityWallet?.onChainUsdcUsd ?? null,
    },
    programs: raw.programs ?? [],
    statement: raw.statement ?? [],
    network: raw.network ?? {
      authorizedUsd: 0,
      claimableUsd: 0,
      settledUsd: 0,
      pendingFundingUsd: 0,
    },
    arc,
    identities: raw.identities ?? {
      github: null,
      emailVerified: false,
      gmailConnected: false,
      gmailOperatorLive: false,
    },
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
  };
}

/** Bank-style hero balance — trust on-chain Arc USDC over stale DB zeros. */
export function boostSnapshotBalances(
  snapshot: BankingAccountSnapshot,
  authAvailableUsd?: number,
): BankingAccountSnapshot {
  const b = snapshot.balances;
  const fromChain =
    b.onChainUsdcUsd != null ? Math.max(0, b.onChainUsdcUsd - b.reservedUsd) : 0;
  const availableUsd = Math.max(b.availableUsd, fromChain, authAvailableUsd ?? 0);
  const onChainUsdcUsd = b.onChainUsdcUsd ?? snapshot.arc.identityWallet?.onChainUsdcUsd ?? null;

  return {
    ...snapshot,
    balances: {
      ...b,
      availableUsd,
      onChainUsdcUsd,
      totalDepositedUsd: Math.max(b.totalDepositedUsd, onChainUsdcUsd ?? availableUsd),
    },
    arc: {
      ...snapshot.arc,
      identityWallet:
        snapshot.arc.identityWallet ?
          {
            ...snapshot.arc.identityWallet,
            onChainUsdcUsd: snapshot.arc.identityWallet.onChainUsdcUsd ?? onChainUsdcUsd,
          }
        : snapshot.arc.identityWallet,
    },
  };
}

export function mergeWalletBalanceIntoSnapshot(
  snapshot: BankingAccountSnapshot,
  wallet: {
    availableUsd: number;
    onChainUsd?: number | null;
    reservedUsd?: number;
  },
): BankingAccountSnapshot {
  const availableUsd = Math.max(snapshot.balances.availableUsd, wallet.availableUsd);
  const onChainUsd =
    snapshot.balances.onChainUsdcUsd ??
    wallet.onChainUsd ??
    snapshot.arc.identityWallet?.onChainUsdcUsd ??
    null;
  const reservedUsd = Math.max(snapshot.balances.reservedUsd, wallet.reservedUsd ?? 0);

  return {
    ...snapshot,
    balances: {
      ...snapshot.balances,
      availableUsd,
      reservedUsd,
      onChainUsdcUsd: onChainUsd,
      totalDepositedUsd: Math.max(
        snapshot.balances.totalDepositedUsd,
        onChainUsd ?? availableUsd,
      ),
    },
    arc: {
      ...snapshot.arc,
      identityWallet:
        snapshot.arc.identityWallet ?
          {
            ...snapshot.arc.identityWallet,
            onChainUsdcUsd:
              snapshot.arc.identityWallet.onChainUsdcUsd ?? onChainUsd,
          }
        : snapshot.arc.identityWallet,
    },
  };
}
