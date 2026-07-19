import type { ProgramTemplateId } from "./catalog";
import type { ObservatoryAlert } from "./observatory";
import type { EconomicMemoryEntry } from "./economic-memory";

export type CommunityInstallRecord = {
  id: string;
  communitySlug: string;
  status: string;
  ecosystemId: string | null;
  connectorIds: string[];
  doctrine: Record<string, unknown> | null;
  installedAt: string;
  updatedAt: string;
};

export type ProgramRules = {
  perPlayUsd?: number;
  perWatchUsd?: number;
  perMergeUsd?: number;
  perCveUsd?: number;
  perCitationUsd?: number;
  minDurationSec?: number;
  minLines?: number;
  splitMode?: string;
  allocationRule?: "verified_activity" | "equal_recipients" | "hybrid";
  eligibilityMode?: "resolved_only" | "manual_review";
  connectorId?: string;
  eventType?: string;
  /** RFB #6 — sponsor match pool and QF exponent */
  matchPoolUsd?: number;
  qfExponent?: number;
  openCollectiveSlug?: string;
  /** Pool funding milestones (USD) — batch payouts unlock as deposits cross each */
  checkpointThresholdsUsd?: number[];
  /** Auto-run Arc batch when a checkpoint is reached and obligations exist */
  autoSettleCheckpoints?: boolean;
  /** Optional retroactive evaluation window. Work must already be verified. */
  retroactiveFunding?: {
    enabled: boolean;
    evaluationDays: number;
  };
  /** Optional, evidence-backed allocation to verified upstream dependencies. */
  dependencySupport?: {
    percent: number;
    evidenceRequired?: boolean;
  };
  /** Non-financial supporter benefits defined by the community program. */
  supporterBenefits?: Array<{
    key: string;
    label: string;
    activation: "confirmed_deposit" | "checkpoint";
    checkpointUsd?: number;
    expiresDays?: number;
    limitations?: string[];
  }>;
};

export type ProgramDeployReadiness = {
  canDeploy: boolean;
  authorizedCount: number;
  authorizedUsd: number;
  pendingObligationsUsd: number;
  fundingGapUsd: number;
  walletMappedCount: number;
  reasons: string[];
};

export type ProgramRecord = {
  id: string;
  installId: string;
  communitySlug: string;
  templateId: ProgramTemplateId | string;
  name: string;
  status: string;
  budgetUsd: number;
  rules: ProgramRules;
  recipients: unknown[];
  missionId: string | null;
  lastDeployAt: string | null;
  lastSettlementId: string | null;
  createdAt: string;
  updatedAt: string;
  deployReadiness?: ProgramDeployReadiness;
};

export type CommunityImpactChain = {
  treasuryUsd: number;
  programBudgetUsd: number;
  communityObligationsUsd: number;
  authorizedUsd: number;
  settledUsd: number;
  platformFeeUsd: number;
  playCount: number;
  artistCount: number;
  estimatedReach: number;
  stages: Array<{
    id: string;
    label: string;
    value: string;
    sublabel?: string;
  }>;
};

export type AuthorizationPreview = {
  id: string;
  payeeKey: string;
  payeeKeyType?: string;
  entityId?: string;
  entityPath?: string;
  amountUsd: number;
  status: string;
  contextLabel: string | null;
  createdAt: string;
};

export type CommunityBuilderVital = {
  label: string;
  amountUsd: number;
};

export type CommunityVitalsSummary = {
  healthPct: number | null;
  healthLabel: string;
  fundingTotalUsd: number;
  fundingLabel: string;
  openWorkCount: number;
  programCount: number;
  topBuilders: CommunityBuilderVital[];
  sensor: {
    gated: boolean;
    live: boolean;
    ready: boolean;
    label: string;
  };
  observeNarrative: string;
  hasLiveData: boolean;
};

export type CommunitySurface = {
  slug: string;
  name: string;
  tagline: string;
  kind: string;
  upstream: string;
  doctrine: string;
  connectors: string[];
  accent: string;
  installed: boolean;
  install: CommunityInstallRecord | null;
  programs: ProgramRecord[];
  health: {
    treasuryUsd: number;
    obligationsUsd: number;
    communityObligationsUsd: number;
    connectorStatus: Array<{
      id: string;
      health: string;
      label: string;
      connectionId?: string | null;
      accountLabel?: string | null;
      lastSuccessfulSync?: string | null;
      currentSyncState?: string | null;
      recordsObserved?: number;
      authExpiresAt?: string | null;
      cachedAt?: string | null;
    }>;
    scrobbleBridge: boolean;
    lastScrobbleAt: string | null;
  };
  impact: CommunityImpactChain;
  observatory: ObservatoryAlert[];
  economicMemory: EconomicMemoryEntry[];
  authorizations: AuthorizationPreview[];
  operatingFacts: {
    resolvedIdentityCount: number;
    unresolvedIdentityCount: number;
    simulationComplete: boolean;
    authorizationStatus: string | null;
  };
  timeline: Array<{
    id: string;
    eventType: string;
    title: string;
    detail: string | null;
    createdAt: string;
  }>;
  deployReadiness: {
    canDeploy: boolean;
    authorizedCount: number;
    authorizedUsd: number;
    pendingObligationsUsd: number;
    fundingGapUsd: number;
    walletMappedCount: number;
    reasons: string[];
  };
};
