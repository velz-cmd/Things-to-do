/** Payment & Settlement Layer — receives verified allocations only. Never scores. */

export type SettlementStatus =
  | "CREATED"
  | "VALIDATING"
  | "ESCROW_LOCKED"
  | "READY"
  | "PROCESSING"
  | "SETTLED"
  | "ARCHIVED"
  | "FAILED";

export type PaymentIntentStatus = "pending" | "processing" | "settled" | "failed" | "retry";

export interface MissionContributor {
  wallet: string;
  login?: string;
  weight: number;
  amount: string;
  rank?: number;
}

export interface CapitalPools {
  mission: number;
  bonus: number;
  emergency: number;
}

export interface MissionSettlementInput {
  missionId: string;
  repo?: string;
  treasuryAmount: number;
  currency?: "USDC";
  confidence: number;
  proofHash: string;
  contributors: MissionContributor[];
  createdAt?: string;
  /** Evidence OS worker ids that ran — for nano agent payouts */
  agentsRun?: string[];
}

export interface PaymentIntent {
  id: string;
  wallet: string;
  login?: string;
  weight: number;
  amountUsd: number;
  rank: number;
  memoId?: string;
  memoText?: string;
  status: PaymentIntentStatus;
  txHash?: string;
}

export interface NanoPaymentRecord {
  agentRole: string;
  purpose: string;
  amountUsd: number;
  recipientWallet: string;
  memoText: string;
  txHash?: string;
  status: PaymentIntentStatus;
}

export interface SettlementPlan {
  settlementId: string;
  missionId: string;
  treasuryAmount: number;
  pools: CapitalPools;
  intents: PaymentIntent[];
  agentNanoTotal: number;
  contributorTotal: number;
  proofHash: string;
}

export interface SettlementProof {
  settlementId: string;
  missionId: string;
  proofHash: string;
  batchNumber: number;
  txHashes: string[];
  memoIds: string[];
  timestamp: string;
  treasuryAmount: number;
  contributorCount: number;
  confidence: number;
  auditHash: string;
}

export interface SettlementResult {
  settlementId: string;
  status: SettlementStatus;
  plan: SettlementPlan;
  nanoPayments: NanoPaymentRecord[];
  proof?: SettlementProof;
  failedWallets: string[];
  explorerUrls: string[];
}

/** Agent nano rates — Circle x402 / memo micro-payouts per pipeline worker */
export const AGENT_NANO_RATES: Record<string, number> = {
  identity_worker: 0.05,
  repository_worker: 0.05,
  pr_worker: 0.05,
  code_worker: 0.75,
  collaboration_worker: 0.1,
  issue_validation: 0.1,
  code_review: 0.75,
  bug_review: 0.2,
  documentation_fix: 0.4,
  comment_moderation: 0.05,
  impact_worker: 0.1,
  reputation_worker: 0.05,
  ecosystem_worker: 0.05,
  reasoning_engine: 0.15,
};

export const SETTLEMENT_CONFIDENCE_MIN = 0.55;
export const AUTO_SETTLE_CONFIDENCE_MIN = 0.72;
