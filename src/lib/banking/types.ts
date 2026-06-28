/** RESOLVE Banking — Arc USDC custody (1:1, no interest, Circle identity wallet). */

export type BankingPolicy = {
  interestBearing: false;
  lending: false;
  currency: "USDC";
  model: "custody";
  rail: "arc";
  tagline: string;
};

export const BANKING_POLICY: BankingPolicy = {
  interestBearing: false,
  lending: false,
  currency: "USDC",
  model: "custody",
  rail: "arc",
  tagline:
    "One Arc USDC account per identity — Circle wallet, memo batch payouts, agent nano-payments",
};

export type StatementLine = {
  id: string;
  at: string;
  type:
    | "deposit"
    | "program_reserve"
    | "distribution"
    | "earn"
    | "claim"
    | "adjustment";
  direction: "credit" | "debit";
  amountUsd: number;
  balanceAfterUsd: number | null;
  label: string;
  reference: string | null;
};

export type BankingProgramWallet = {
  id: string;
  name: string;
  communitySlug: string;
  budgetUsd: number;
  committedUsd: number;
  authorizedUsd: number;
  status: string;
};

export type BankingMemoActivity = {
  id: string;
  at: string;
  kind: "batch_memo" | "claim" | "nano";
  amountUsd: number;
  txHash: string;
  label: string;
  batchNumber: number | null;
};

export type BankingArcRail = {
  chain: string;
  chainId: number;
  currency: "USDC";
  usdcGas: true;
  live: boolean;
  canDistribute: boolean;
  blockers: string[];
  message: string;
  contracts: {
    usdc: string;
    memo: string;
  };
  agentWallet: string | null;
  settlementWallet: string | null;
  settlementBalanceUsd: number | null;
  explorerUrl: string;
  capabilities: {
    identityWallet: boolean;
    depositArcUsdc: boolean;
    batchMemoPayouts: boolean;
    agentNanoPayments: boolean;
    erc8183Escrow: boolean;
    cctpBridge: boolean;
  };
  stats: {
    nanoPaymentsSettled: number;
    recentMemoCount: number;
  };
  identityWallet: {
    address: string;
    label: string;
    provider: "circle" | "embedded";
    circleWalletId: string | null;
    depositAddress: string;
    onChainUsdcUsd: number | null;
  } | null;
  recentMemos: BankingMemoActivity[];
};

export type BankingAccountSnapshot = {
  ok: true;
  signedIn: boolean;
  accountId: string | null;
  displayName: string | null;
  email: string | null;
  memberSince: string | null;
  walletAddress: string | null;
  walletLabel: string | null;
  policy: BankingPolicy;
  balances: {
    availableUsd: number;
    reservedUsd: number;
    earnedClaimableUsd: number;
    earnedAuthorizedUsd: number;
    earnedSettledUsd: number;
    totalDepositedUsd: number;
    onChainUsdcUsd: number | null;
  };
  programs: BankingProgramWallet[];
  statement: StatementLine[];
  network: {
    authorizedUsd: number;
    claimableUsd: number;
    settledUsd: number;
    pendingFundingUsd: number;
  };
  arc: BankingArcRail;
  identities: {
    github: string | null;
    emailVerified: boolean;
    gmailConnected: boolean;
    gmailOperatorLive: boolean;
  };
  updatedAt: string;
};
