export type DistributionPlatform =
  | "navidrome"
  | "owncast"
  | "immich"
  | "mastodon"
  | "jellyfin"
  | "github"
  | "generic";

export interface DistributionEventInput {
  eventId: string;
  type: string;
  platformId?: string;
  amountUsd: number;
  payload: Record<string, unknown>;
}

export interface DistributeRequest {
  platform: DistributionPlatform;
  events: DistributionEventInput[];
  verifySampleRate?: number;
}

export interface ResolvedPayment {
  eventId: string;
  wallet: string;
  payeeName: string | null;
  amountUsd: number;
  verified: boolean;
  verifyReason: string;
  confidence: number;
  proofHash: string;
  type: string;
}

export interface DistributeResult {
  batchId: string;
  status: string;
  totalAmountUsd: number;
  payeeCount: number;
  eventCount: number;
  verifiedCount: number;
  rejectedCount: number;
  txHash: string | null;
  explorerUrl: string | null;
  payments: ResolvedPayment[];
  complianceCsv: string;
}
