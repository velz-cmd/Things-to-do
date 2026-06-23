export type SettlementMode = "live_arc" | "mock_arc";

export type SettlementStatus =
  | "not_started"
  | "wallet_required"
  | "awaiting_funding"
  | "escrow_pending"
  | "escrow_locked"
  | "proof_pending"
  | "proof_submitted"
  | "release_pending"
  | "released"
  | "refund_pending"
  | "refunded"
  | "failed";

export type ArcTxStatus =
  | "not_submitted"
  | "circle_pending"
  | "submitted"
  | "rpc_confirmed"
  | "explorer_indexed"
  | "failed";

export type SettlementRecord = {
  id: string;
  taskId: string;
  mode: SettlementMode;
  status: SettlementStatus;
  amountUsdc: string;
  executionCostUsdc: string;
  chainId: number;
  contractAddress?: string;
  jobId?: string;
  proofHash?: string;
  createJobTxHash?: string;
  approveTxHash?: string;
  fundTxHash?: string;
  submitProofTxHash?: string;
  releaseTxHash?: string;
  refundTxHash?: string;
  explorerUrls: string[];
  lastVerifiedAt?: string;
  error?: string;
  blockers?: string[];
};

export type ArcTxVerification = {
  txHash: string;
  found: boolean;
  success: boolean;
  status: ArcTxStatus;
  blockNumber?: string;
  explorerUrl?: string;
  error?: string;
};

export type CreateEscrowInput = {
  taskId: string;
  amountUsdc: number;
  description: string;
  clientWallet?: string;
};

export type SubmitProofInput = {
  taskId: string;
  proofHash: string;
};

export type ReleaseInput = {
  taskId: string;
  reason?: string;
};

export type RefundInput = {
  taskId: string;
  reason?: string;
};

export interface SettlementAdapter {
  mode: SettlementMode;
  createEscrow(input: CreateEscrowInput): Promise<SettlementRecord>;
  submitProof(input: SubmitProofInput): Promise<SettlementRecord>;
  release(input: ReleaseInput): Promise<SettlementRecord>;
  refund(input: RefundInput): Promise<SettlementRecord>;
  getStatus(taskId: string): Promise<SettlementRecord>;
  verifyTx(txHash: string): Promise<ArcTxVerification>;
}

export type SettlementApiResponse = {
  ok: boolean;
  mode: SettlementMode;
  settlement: SettlementRecord;
  message?: string;
  error?: string;
};
