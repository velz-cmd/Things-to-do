export type ImpactSignalId =
  | "engagement_depth"
  | "contribution_complexity"
  | "consistency"
  | "community_endorsement"
  | "proof_integrity"
  | "reach_proxy"
  | "suspicion_penalty";

export interface ImpactSignal {
  id: ImpactSignalId;
  label: string;
  weight: number;
  score: number;
  rationale: string;
}

export interface WeightedEvent {
  eventId: string;
  type: string;
  platformId?: string;
  payeeKey: string;
  payeeName: string | null;
  verified: boolean;
  impactScore: number;
  signals: ImpactSignal[];
  rationale: string;
  rawAmountUsd: number;
}

export interface ContributorWeight {
  payeeKey: string;
  payeeName: string | null;
  wallet: string | null;
  totalWeight: number;
  sharePercent: number;
  payoutUsd: number;
  eventCount: number;
  topRationale: string;
  events: WeightedEvent[];
}

export interface ImpactEvaluation {
  fundPoolUsd: number;
  totalWeight: number;
  eventCount: number;
  contributorCount: number;
  contributors: ContributorWeight[];
  events: WeightedEvent[];
  weightProofHash: string;
  evaluatedAt: string;
}

export interface HiddenBuilder {
  id: string;
  name: string;
  role: string;
  platform: string;
  handle: string;
  impactScore: number;
  fundingReadiness: number;
  signals: { label: string; value: string; severity: "high" | "medium" | "low" }[];
  unpaidUsdEstimate: number;
  headline: string;
  live?: boolean;
}
