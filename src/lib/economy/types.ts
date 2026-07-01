/**
 * RESOLVE Economic Infrastructure — canonical types.
 * Combines Codex profit engines, capital modes, entry doors, and unified phases.
 * @see docs/ECONOMIC-INFRASTRUCTURE.md
 */

/** Six profit engines — how value enters and monetizes the network */
export type ProfitEngineId =
  | "earn"
  | "fund"
  | "operate"
  | "repayment"
  | "risk"
  | "build";

/** Seven entry doors — onboarding and dashboard routing */
export type EntryDoorId =
  | "earn"
  | "fund"
  | "operate"
  | "protect"
  | "grow"
  | "build"
  | "settle";

/** Five capital modes — why funders put money in (not charity framing) */
export type CapitalModeId =
  | "impact"
  | "sponsor"
  | "repayment"
  | "risk"
  | "growth";

export type EcosystemActorId =
  | "creator"
  | "funder"
  | "founder"
  | "operator"
  | "company"
  | "developer"
  | "dao_member"
  | "audience";

export type InfrastructurePhaseGroup =
  | "shipped"
  | "codex"
  | "advanced";

export type InfrastructurePhaseStatus =
  | "complete"
  | "partial"
  | "planned"
  | "in_progress";

export type RepaymentWaterfallTier = {
  id: string;
  label: string;
  /** Share of inflow (0–1) until cap reached */
  shareBps: number;
  recipient: "creators" | "funders" | "operators" | "platform" | "community";
  capMultiplier?: number;
};

export type RepaymentProgramConfig = {
  enabled: boolean;
  /** e.g. 150 = 1.5× principal cap for funders */
  funderCapMultiplier: number;
  /** bps of future inflows routed to funder repayment (e.g. 1500 = 15%) */
  inflowRepaymentBps: number;
  /** Sources counted as inflow for waterfall */
  inflowSources: Array<
    | "opencollective"
    | "github_sponsors"
    | "sponsorship"
    | "api_revenue"
    | "donations"
    | "protocol_treasury"
    | "program_stakes"
    | "settlement_surplus"
  >;
  waterfall: RepaymentWaterfallTier[];
};

export type ProgramEconomyConfig = {
  templateId: string;
  capitalMode: CapitalModeId;
  engineIds: ProfitEngineId[];
  entryDoors: EntryDoorId[];
  repayment?: RepaymentProgramConfig;
  operatorRetainerBps?: number;
  sponsorBenefits?: string[];
  riskScope?: {
    dependencyPackages?: string[];
    criticalMaintainerIds?: string[];
  };
};

export type NetworkArtifactKind =
  | "claim_receipt"
  | "funder_impact"
  | "operator_program"
  | "company_risk_report"
  | "developer_api_key"
  | "dao_settlement_archive"
  | "repayment_statement";

export type PlatformRevenueStreamId =
  | "settlement_fee"
  | "x402_agent"
  | "operator_saas"
  | "company_reports"
  | "api_usage"
  | "program_setup"
  | "repayment_pool_fee"
  | "white_label";

export type EconomicInfrastructureManifest = {
  version: string;
  thesis: string;
  positioning: string;
  engines: ProfitEngine[];
  entryDoors: EntryDoor[];
  capitalModes: CapitalMode[];
  programTemplates: EconomyProgramTemplate[];
  platformRevenue: PlatformRevenueStream[];
  networkArtifacts: NetworkArtifact[];
  phases: InfrastructurePhase[];
  flow: ValueFlowStage[];
  actorMatrix: ActorEngineMatrix[];
};

export type ProfitEngine = {
  id: ProfitEngineId;
  name: string;
  tagline: string;
  forActors: EcosystemActorId[];
  valueProposition: string;
  mechanisms: string[];
  monetization: string[];
  entryDoor: EntryDoorId;
  apiSurfaces: string[];
  shipped: boolean;
  shippedDetail?: string;
};

export type EntryDoor = {
  id: EntryDoorId;
  label: string;
  headline: string;
  description: string;
  dashboardPath: string;
  engineIds: ProfitEngineId[];
  primaryCta: { label: string; href: string };
  habitLoop: string;
};

export type CapitalMode = {
  id: CapitalModeId;
  label: string;
  funderGets: string;
  bestFor: EcosystemActorId[];
  programTemplates: string[];
  repaymentCapMultiplier?: { min: number; max: number };
  shipped: boolean;
};

export type EconomyProgramTemplate = {
  id: string;
  name: string;
  rfb?: string;
  engines: ProfitEngineId[];
  capitalModes: CapitalModeId[];
  upstream: string;
  description: string;
  defaultBudgetUsd: number;
  shipped: boolean;
  catalogTemplateId?: string;
};

export type PlatformRevenueStream = {
  id: PlatformRevenueStreamId;
  label: string;
  model: string;
  defaultRate?: string;
  envKey?: string;
  shipped: boolean;
};

export type NetworkArtifact = {
  kind: NetworkArtifactKind;
  actor: EcosystemActorId;
  label: string;
  pathPattern: string;
  retentionHook: string;
  shipped: boolean;
};

export type InfrastructurePhase = {
  id: string;
  group: InfrastructurePhaseGroup;
  name: string;
  summary: string;
  status: InfrastructurePhaseStatus;
  deliverables: string[];
  dependsOn?: string[];
};

export type ValueFlowStage = {
  order: number;
  stage: string;
  description: string;
  apiRoute?: string;
  onChain: boolean;
};

export type ActorEngineMatrix = {
  actor: EcosystemActorId;
  label: string;
  engines: ProfitEngineId[];
  whyTheyStay: string;
  size: "small" | "large" | "both";
};
