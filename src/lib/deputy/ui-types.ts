export interface TaskEvent {
  id: string;
  agent: string;
  phase: string;
  message: string;
  createdAt: string;
}

export interface Proof {
  id: string;
  type: string;
  source: string;
  contentHash: string;
  verified: boolean;
  payload: string;
  artifactUrl?: string | null;
}

export interface MicroPayment {
  id: string;
  purpose: string;
  amountUsd: number;
  txHash: string | null;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  status: string;
  targetValueUsd: number;
  recoveredUsd: number;
  executionCostUsd: number;
  successFeeUsd: number;
  budgetUsd: number;
  currentAgent: string | null;
  proofHash: string | null;
  settlementTxHash: string | null;
  escrowTxHash: string | null;
  escrowLocked: boolean;
  merchantId: string | null;
  events: TaskEvent[];
  proofs?: Proof[];
  microPayments?: MicroPayment[];
}

export interface DashboardStats {
  moneyRecoveredUsd: number;
  subscriptionsCancelled: number;
  executionCostUsd: number;
  netGainUsd: number;
  tasksCompleted: number;
  activeTasks: number;
  recentTasks?: Task[];
}

export interface OutcomeTemplate {
  id: string;
  title: string;
  description: string;
  targetValueUsd: number;
  merchantId: string;
}

export const AGENT_PIPELINE = [
  "Planner",
  "Evidence",
  "Executor",
  "Retry",
  "Verification",
  "Escalation",
] as const;

export const FUTURE_OUTCOMES = [
  { title: "Scam Protection Vault", status: "coming_soon" },
  { title: "Wallet Recovery Detective", status: "coming_soon" },
  { title: "Subscription Optimizer", status: "coming_soon" },
  { title: "Bill Negotiation", status: "coming_soon" },
];
