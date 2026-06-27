import type { MissionPhase } from "@/lib/mission/phases";
import type { MissionFinding } from "@/lib/workspace/advisors/intelligence-findings";
import type { PolicyProposal } from "@/lib/workspace/advisors/policy-proposals";
import type { OpportunityCard } from "@/lib/workspace/advisors/opportunity-cards";
import type { ValueConcentration } from "@/lib/workspace/advisors/concentrations";
import type { WorkspaceEvidence } from "@/lib/workspace/context";
import type { FundingOpportunity } from "@/lib/github/types";
import type { IntelligenceBrief } from "@/lib/mission/intelligence-brief";
import type { MissionReport } from "@/lib/mission/mission-report";
import type { CapabilityLayer, CommunityContext, DataSource } from "@/lib/mission/community";
import type {
  CapitalBlueprint,
  CapitalLoopPhase,
  MissionJob,
  OperatingMode,
} from "@/lib/mission/capital-os";

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

export type { CapabilityLayer, CommunityContext, DataSource };

export type CommunityRepoRef = {
  owner: string;
  repo: string;
  fullName: string;
  stars?: number;
  fundingGapUsd?: number;
};

/** @deprecated use CommunityRepoRef */
export type EcosystemRepoRef = CommunityRepoRef;

export type CollectorTrace = {
  source: DataSource;
  layer?: CapabilityLayer;
  status: "ok" | "empty" | "skipped";
  summary: string;
};

export type MissionActionType =
  | "chat"
  | "navigate"
  | "prepare_settlement"
  | "execute_settlement"
  | "save_knowledge"
  | "open_claim"
  | "fund_treasury"
  | "github_allocate";

export type CapabilityAction = {
  id: string;
  label: string;
  prompt: string;
  kind: "explore" | "simulate" | "plan" | "execute" | "remember" | "navigate";
  href?: string;
  /** When set, chat dispatches a real action instead of re-prompting. */
  actionType?: MissionActionType;
};

export type ResearchReference = {
  title: string;
  url: string;
  snippet: string;
  provider: string;
};

export type MissionQuickAction = {
  id: string;
  label: string;
  prompt: string;
  group?: string;
};

export type OrchestratorContext = {
  question: string;
  capability: CapabilityId;
  capabilityLabel: string;
  phase: MissionPhase;
  community: CommunityContext;
  evidence: WorkspaceEvidence;
  traces: CollectorTrace[];
  opportunities: FundingOpportunity[];
  findings: MissionFinding[];
  policies: PolicyProposal[];
  concentrations: ValueConcentration[];
  opportunityCards: OpportunityCard[];
  capitalUsd?: number;
  compareTargets: string[];
  /** Active community world name */
  communityName?: string;
  /** @deprecated use communityName */
  ecosystemName?: string;
  researchReferences?: ResearchReference[];
  quickActions?: MissionQuickAction[];
  stepsRun: string[];
  job?: MissionJob;
  operatingMode?: OperatingMode;
  loopPhase?: CapitalLoopPhase;
  capitalBlueprint?: CapitalBlueprint;
};

export type OrchestratorResult = {
  capability: CapabilityId;
  capabilityLabel: string;
  phase: MissionPhase;
  community: CommunityContext;
  answer: string;
  headline: string;
  brief: IntelligenceBrief;
  report: MissionReport;
  findings: MissionFinding[];
  actions: CapabilityAction[];
  stepsRun: string[];
  traces: CollectorTrace[];
  policies: PolicyProposal[];
  opportunities: OpportunityCard[];
  concentrations: ValueConcentration[];
  researchReferences: ResearchReference[];
  quickActions: MissionQuickAction[];
  grounded: boolean;
  requiresApproval: boolean;
  durationMs: number;
};

export type CapabilityDef = {
  id: CapabilityId;
  label: string;
  purpose: string;
  requiredLayers: CapabilityLayer[];
  steps: string[];
  actions: (ctx: OrchestratorContext) => CapabilityAction[];
};
