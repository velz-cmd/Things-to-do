export const DEPUTY_DOCTRINE = {
  outcomeFirst:
    "Optimize for verified resolution, not messages, tokens, or tool calls.",
  proofOrNothing:
    "An outcome is complete only when evidence confirms it — never on agent opinion alone.",
  leastPowerfulFirst:
    "Search, gather, draft before submit, cancel, dispute, or release escrow.",
  escalateBeforeDamage:
    "Low confidence, high risk, or unclear authority → escalate, do not guess.",
  payOnlyForResolution:
    "Arc settlement unlocks only when the proof engine returns VERIFIED.",
} as const;

export type TaskStatus =
  | "created"
  | "authorized"
  | "evidence_gathering"
  | "planning"
  | "executing"
  | "waiting_for_response"
  | "retrying"
  | "escalated"
  | "proof_pending"
  | "verified"
  | "settled"
  | "failed"
  | "refunded";

export type AgentRole =
  | "Planner"
  | "Evidence"
  | "Executor"
  | "Retry"
  | "Negotiator"
  | "Verification"
  | "Escalation";

export const AGENT_PIPELINE: AgentRole[] = [
  "Planner",
  "Evidence",
  "Executor",
  "Retry",
  "Verification",
];

export const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  created: ["authorized", "failed"],
  authorized: ["evidence_gathering", "failed"],
  evidence_gathering: ["planning", "failed"],
  planning: ["executing", "failed"],
  executing: ["waiting_for_response", "retrying", "proof_pending", "failed"],
  waiting_for_response: ["retrying", "proof_pending", "escalated", "failed"],
  retrying: ["executing", "waiting_for_response", "escalated", "failed"],
  escalated: ["executing", "proof_pending", "failed"],
  proof_pending: ["verified", "failed", "retrying"],
  verified: ["settled", "failed"],
  settled: [],
  failed: ["refunded"],
  refunded: [],
};

export interface OutcomeTemplate {
  id: string;
  title: string;
  category: string;
  targetValueUsd: number;
  merchantId: string;
  description: string;
}

export const DEMO_OUTCOMES: OutcomeTemplate[] = [
  {
    id: "airline-refund-43",
    title: "Recover delayed flight compensation",
    category: "money_recovery",
    targetValueUsd: 43,
    merchantId: "skydemo-airlines",
    description: "Get my $43 refund from SkyDemo Airlines for flight SD-482 delay",
  },
  {
    id: "subscription-cancel",
    title: "Cancel unused streaming subscription",
    category: "subscription",
    targetValueUsd: 12.99,
    merchantId: "streamdemo",
    description: "Cancel StreamDemo Plus and prove billing stopped",
  },
  {
    id: "parcel-compensation",
    title: "Recover parcel delay compensation",
    category: "money_recovery",
    targetValueUsd: 25,
    merchantId: "parceldemo",
    description: "Claim $25 compensation for ParcelDemo late delivery",
  },
];

export const PROOF_POLICIES: Record<string, string[]> = {
  money_recovery: [
    "refund_confirmation_email",
    "merchant_api_refund_status",
    "transaction_receipt",
  ],
  subscription: [
    "cancellation_confirmation_email",
    "portal_status_cancelled",
    "support_ticket_closed",
  ],
};
