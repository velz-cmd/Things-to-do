/** Pool checkpoint + funder position — real USD balances vs labeled projections. */

export type PoolCheckpointStatus = "locked" | "active" | "reached" | "paid";

export type PoolCheckpointRow = {
  thresholdUsd: number;
  status: PoolCheckpointStatus;
  /** Real USD paid in batch when status is paid */
  paidUsd: number | null;
  settlementId: string | null;
  payeeCount: number | null;
  triggeredAt: string | null;
};

export type PoolBatchRow = {
  id: string;
  settledUsd: number;
  payeeCount: number;
  at: string;
  checkpointThresholdUsd: number | null;
};

export type PoolFunderPosition = {
  userId: string | null;
  yourDepositUsd: number;
  yourSharePct: number;
  /** Real — your stake's share of pool already released to payees */
  yourReleasedUsd: number;
  /**
   * Projection — your deposit % × total owed queue (not guaranteed).
   * Shown separately from real balances.
   */
  estimatedShareOfOwedUsd: number;
  /** Projection — yield/impact model attribution for this stake */
  projectedImpactUsd: number;
};

export type ProgramPoolState = {
  programId: string;
  programName: string;
  communitySlug: string;
  templateId: string;
  payeeCategory: string;
  /** Real USDC in pool (stakes principal, not double-counting owner budget) */
  poolBalanceUsd: number;
  totalDepositedUsd: number;
  releasedUsd: number;
  availableUsd: number;
  /** Real — authorized + pending_funding owed to creators */
  owedToCreatorsUsd: number;
  /** Real — already settled on Arc */
  settledUsd: number;
  claimableUsd: number;
  funderCount: number;
  checkpoints: PoolCheckpointRow[];
  nextCheckpointUsd: number | null;
  progressToNextPct: number;
  recentBatches: PoolBatchRow[];
  autoSettleEnabled: boolean;
  funder: PoolFunderPosition;
};

export type StoredCheckpointRecord = {
  thresholdUsd: number;
  triggeredAt: string;
  settlementId?: string;
  paidUsd?: number;
  payeeCount?: number;
  status: "paid" | "reached";
};

export type ProgramPoolMetadata = {
  communitySlug?: string;
  checkpoints?: StoredCheckpointRecord[];
};
