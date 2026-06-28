/** RESOLVE Banking — custody model (1:1 USDC, no interest, same rails for all users). */

export type BankingPolicy = {
  interestBearing: false;
  lending: false;
  currency: "USDC";
  model: "custody";
  tagline: string;
};

export const BANKING_POLICY: BankingPolicy = {
  interestBearing: false,
  lending: false,
  currency: "USDC",
  model: "custody",
  tagline: "Deposit · hold · distribute — no interest, no lending, one account for everyone",
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
  };
  programs: BankingProgramWallet[];
  statement: StatementLine[];
  network: {
    authorizedUsd: number;
    claimableUsd: number;
    settledUsd: number;
    pendingFundingUsd: number;
  };
  settlementRail: {
    balanceUsd: number;
    wallet: string | null;
    role: string;
  };
  identities: {
    github: string | null;
    emailVerified: boolean;
    gmailConnected: boolean;
    gmailOperatorLive: boolean;
  };
  updatedAt: string;
};
