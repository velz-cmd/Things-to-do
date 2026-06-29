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
  connectorId?: string;
  eventType?: string;
  /** RFB #6 — sponsor match pool and QF exponent */
  matchPoolUsd?: number;
  qfExponent?: number;
  openCollectiveSlug?: string;
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
    connectorStatus: Array<{ id: string; health: string; label: string }>;
    scrobbleBridge: boolean;
    lastScrobbleAt: string | null;
  };
  impact: CommunityImpactChain;
  observatory: ObservatoryAlert[];
  economicMemory: EconomicMemoryEntry[];
  authorizations: AuthorizationPreview[];
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
    walletMappedCount: number;
    reasons: string[];
  };
};
