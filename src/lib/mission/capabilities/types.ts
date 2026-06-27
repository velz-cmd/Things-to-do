import type { MissionPhase } from "@/lib/mission/phases";
import type { MissionFinding } from "@/lib/workspace/advisors/intelligence-findings";
import type { PolicyProposal } from "@/lib/workspace/advisors/policy-proposals";
import type { OpportunityCard } from "@/lib/workspace/advisors/opportunity-cards";
import type { ValueConcentration } from "@/lib/workspace/advisors/concentrations";
import type { WorkspaceEvidence } from "@/lib/workspace/context";
import type { FundingOpportunity } from "@/lib/github/types";

export type CapabilityId =
  | "discover_value_leaks"
  | "allocate_capital"
  | "compare_ecosystems"
  | "assess_risk"
  | "claim_value"
  | "research_ecosystem"
  | "explain_evidence"
  | "execute_settlement"
  | "general_inquiry";

export type DataSource =
  | "treasury"
  | "ledger"
  | "github"
  | "connectors"
  | "policies"
  | "concentrations"
  | "openalex"
  | "upstream";

export type EcosystemRepoRef = {
  owner: string;
  repo: string;
  fullName: string;
  stars?: number;
  fundingGapUsd?: number;
};

export type CollectorTrace = {
  source: DataSource;
  status: "ok" | "empty" | "skipped";
  summary: string;
};

export type CapabilityAction = {
  id: string;
  label: string;
  prompt: string;
  kind: "explore" | "simulate" | "plan" | "execute" | "remember" | "navigate";
  href?: string;
};

export type OrchestratorContext = {
  question: string;
  capability: CapabilityId;
  capabilityLabel: string;
  phase: MissionPhase;
  evidence: WorkspaceEvidence;
  traces: CollectorTrace[];
  opportunities: FundingOpportunity[];
  findings: MissionFinding[];
  policies: PolicyProposal[];
  concentrations: ValueConcentration[];
  opportunityCards: OpportunityCard[];
  capitalUsd?: number;
  compareTargets: string[];
  ecosystemName?: string;
  stepsRun: string[];
};

export type OrchestratorResult = {
  capability: CapabilityId;
  capabilityLabel: string;
  phase: MissionPhase;
  answer: string;
  headline: string;
  findings: MissionFinding[];
  actions: CapabilityAction[];
  stepsRun: string[];
  traces: CollectorTrace[];
  policies: PolicyProposal[];
  opportunities: OpportunityCard[];
  concentrations: ValueConcentration[];
  grounded: boolean;
  requiresApproval: boolean;
};
