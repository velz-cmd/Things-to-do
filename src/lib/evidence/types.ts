/** RESOLVE Evidence OS — common language for all sensors (GitHub v1). */

export type EvidenceKind =
  | "identity"
  | "repository"
  | "contribution"
  | "code"
  | "collaboration"
  | "impact"
  | "reputation";

export type TrustTier =
  | "verified"
  | "likely_verified"
  | "unknown"
  | "likely_sybil"
  | "rejected";

export type SettlementStatus =
  | "auto_settle"
  | "founder_review"
  | "hold"
  | "excluded";

/** Immutable evidence published by a worker — never edited by other workers. */
export interface WorkerEvidence {
  id: string;
  worker: string;
  kind: EvidenceKind;
  /** Subject: `pr:42`, `user:alice`, `repo:owner/name` */
  subjectId: string;
  confidence: number;
  facts: string[];
  metadata: Record<string, unknown>;
  producedAt: string;
}

export interface NormalizedArtifact {
  id: string;
  type: "pull_request" | "issue" | "review" | "release" | "commit";
  repoFullName: string;
  authorLogin: string;
  timestamp?: string;
  raw: Record<string, unknown>;
}

export interface ConfidenceBundle {
  identity: number;
  contribution: number;
  impact: number;
  evidenceQuality: number;
  settlement: number;
  tier: TrustTier;
  status: SettlementStatus;
  coherenceFlags: string[];
}

export interface ReasoningVerdict {
  subjectId: string;
  prNumber?: number;
  author: string;
  valueWeight: number;
  category: string;
  confidence: ConfidenceBundle;
  reasoning: string[];
  workerEvidenceIds: string[];
  status: "verified" | "needs_review" | "excluded";
}

export interface ProofBundle {
  evidenceHash: string;
  reasoningHash: string;
  verdictHash: string;
  settlementHash: string;
  proofRoot: string;
}
