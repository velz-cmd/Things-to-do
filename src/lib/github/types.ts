/** GitHub Phase 1 — Capital Flow Protocol sensor types */

export interface GitHubContributor {
  login: string;
  id: number;
  avatarUrl?: string;
  accountCreatedAt?: string;
  publicRepos?: number;
  followers?: number;
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  author: string;
  authorId: number;
  state: string;
  merged: boolean;
  mergedAt?: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  reviewComments: number;
  commits: number;
  labels: string[];
  body?: string;
  sourceUrl?: string;
  reviews?: GitHubReview[];
  diffSnippet?: string;
  files: { path: string; additions: number; deletions: number }[];
}

export interface GitHubReview {
  author: string;
  state: string;
  body?: string;
  submittedAt?: string;
}

export interface GitHubIssue {
  number: number;
  title: string;
  author: string;
  state: string;
  comments: number;
  labels: string[];
  closedAt?: string;
  updatedAt?: string;
  sourceUrl?: string;
}

export interface GitHubRelease {
  id: number;
  tagName: string;
  name: string;
  author: string;
  publishedAt?: string;
  sourceUrl: string;
}

export interface RepoIngestResult {
  owner: string;
  repo: string;
  fullName: string;
  description?: string;
  stars: number;
  forks: number;
  openIssues: number;
  defaultBranch: string;
  pushedAt?: string;
  contributors: GitHubContributor[];
  pullRequests: GitHubPullRequest[];
  issues: GitHubIssue[];
  releases: GitHubRelease[];
  ingestedAt: string;
}

export type GitHubWorkCategory =
  | "code"
  | "review"
  | "documentation"
  | "issue_resolution"
  | "release_work"
  | "support"
  | "security";

export interface GitHubFundingActivityRecord {
  id: string;
  category: GitHubWorkCategory;
  title: string;
  actor: string;
  occurredAt: string;
  sourceUrl: string;
  sourceKind: "pull_request" | "review" | "issue" | "release";
}

export interface GitHubFundingContributor {
  login: string;
  avatarUrl?: string;
  acceptedActivityCount: number;
  categories: Partial<Record<GitHubWorkCategory, number>>;
}

export interface GitHubFundingActivitySnapshot {
  observedAt: string;
  rangeStart: string | null;
  rangeEnd: string;
  records: GitHubFundingActivityRecord[];
  counts: Record<GitHubWorkCategory, number>;
  contributors: GitHubFundingContributor[];
}

export interface TrustScore {
  login: string;
  score: number;
  confidence: number;
  signals: { label: string; value: string; weight: number }[];
  status: "trusted" | "low_trust" | "sybil_risk";
}

export interface RepoHealthScore {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  signals: { label: string; value: string; impact: "positive" | "negative" | "neutral" }[];
  maintainerCount: number;
  mergedPrCount?: number;
  avgMergeDays?: number;
  fundingGapUsd: number;
  headline: string;
}

export interface FounderIntent {
  infrastructure: number;
  documentation: number;
  community: number;
  research: number;
  bugfix: number;
}

export const DEFAULT_FOUNDER_INTENT: FounderIntent = {
  infrastructure: 50,
  documentation: 20,
  community: 20,
  research: 5,
  bugfix: 5,
};

export interface CouncilAgentVerdict {
  agent: "code_impact" | "project_impact" | "economic_impact";
  score: number;
  reasoning: string;
  modelId?: string;
}

export interface PRWeightVerdict {
  prNumber: number;
  author: string;
  category: keyof FounderIntent;
  trustScore: number;
  agents: CouncilAgentVerdict[];
  finalWeight: number;
  confidence: number;
  status: "verified" | "sybil" | "manual_review";
  evidence: string[];
}

export interface ContributorAllocation {
  login: string;
  avatarUrl?: string;
  trustScore: number;
  totalWeight: number;
  sharePercent: number;
  payoutUsd: number;
  prCount: number;
  topEvidence: string[];
  verdicts: PRWeightVerdict[];
}

export interface FundingOpportunity {
  id: string;
  owner: string;
  repo: string;
  fullName: string;
  description?: string;
  stars: number;
  forks: number;
  health: RepoHealthScore;
  unfundedMaintainers: number;
  highImpactPrs: number;
  headline: string;
  priority: "critical" | "high" | "medium";
  live: boolean;
  activity?: GitHubFundingActivitySnapshot;
}

export interface GitHubAllocationResult {
  owner: string;
  repo: string;
  fundPoolUsd: number;
  evaluationDays: number;
  founderIntent: FounderIntent;
  repoHealth: RepoHealthScore;
  contributors: ContributorAllocation[];
  totalWeight: number;
  weightProofHash: string;
  evaluatedAt: string;
  transparency: { login: string; score: number; evidence: string[]; payoutUsd: number }[];
}
