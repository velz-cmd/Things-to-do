export const DISCOVER_VIEWS = [
  "for_you",
  "explore",
  "activity",
  "outcomes",
] as const;

export type DiscoverView = (typeof DISCOVER_VIEWS)[number];

export const DISCOVER_INTENTS = [
  "earn",
  "fund",
  "operate",
  "publish",
  "build",
  "explore",
] as const;
export type DiscoverIntent = (typeof DISCOVER_INTENTS)[number];

export const DISCOVER_EXPLORE_KINDS = [
  "all",
  "people",
  "work",
  "pools",
  "programs",
  "communities",
  "outcomes",
  "funding_gaps",
] as const;

export type DiscoverExploreKind = (typeof DISCOVER_EXPLORE_KINDS)[number];

export const OPPORTUNITY_TYPES = [
  "task",
  "bounty",
  "grant",
  "campaign",
  "role",
  "project_contribution",
  "repository_fix",
  "research_request",
  "community_proposal",
  "creator_collaboration",
  "agent_service_request",
] as const;

export type OpportunityType = (typeof OPPORTUNITY_TYPES)[number];

export type OpportunityCreatorType =
  | "founder"
  | "funder"
  | "community"
  | "dao"
  | "individual"
  | "creator"
  | "maintainer"
  | "agent"
  | "organisation";

export type FundingStatus =
  "unfunded" | "partially_funded" | "funded" | "escrowed" | "milestone_funded";

export type FundingAmountState =
  | "configured_target"
  | "proposed_reward"
  | "policy_calculated"
  | "funding_reserved"
  | "submitted"
  | "confirmed"
  | "provenance_unavailable";

export type DiscoverWorkbenchTarget =
  | {
      panel: "evidence";
      subjectId: string;
      sourceUrl?: string;
      repository?: string;
      evidenceIds: string[];
    }
  | {
      panel: "payout_destination";
      subjectId: string;
    }
  | {
      panel: "direct_support";
      subjectId: string;
      recipientUserId: string;
      recipientLabel: string;
    }
  | {
      panel: "work_funding";
      subjectId: string;
      recipientUserId: string;
      recipientLabel: string;
      workTitle: string;
      repository: string;
      sourceUrl: string;
      evidenceIds: string[];
    }
  | {
      panel: "pool_funding";
      subjectId: string;
      programId: string;
      communitySlug: string;
      poolName: string;
      poolType?: string;
      purpose?: string;
      balanceUsd?: number;
      targetUsd?: number;
      activeRule?: string;
    }
  | {
      panel: "program_setup";
      subjectId: string;
      programId?: string;
      communitySlug: string;
      step:
        "create" | "source" | "publication" | "policy" | "treasury" | "review";
    }
  | {
      panel: "source_sync";
      subjectId: string;
      provider: "github";
      repository?: string;
    }
  | {
      panel: "authorization_review";
      subjectId: string;
      authorizationId?: string;
    }
  | {
      panel: "receipt";
      subjectId: string;
      receiptUrl: string;
      explorerUrl?: string;
    }
  | {
      panel: "transaction";
      subjectId: string;
      fundingIntentId: string;
    }
  | {
      panel: "entity_details";
      subjectId: string;
      entityType: "person" | "work" | "pool" | "program" | "community";
    };

export type DiscoverActionPresentation =
  | { kind: "workbench"; target: DiscoverWorkbenchTarget }
  | {
      kind: "navigation";
      target: "discover" | "external" | "workspace";
      secondary: boolean;
    };

export type DiscoverAction = {
  id: ResolveActionId;
  label: string;
  href: string;
  description?: string;
  enabled: boolean;
  disabledReason?: string;
  requiresConfirmation?: boolean;
  presentation: DiscoverActionPresentation;
};

export type DiscoverEntityState = {
  provenance:
    | "external_integration"
    | "operator_created"
    | "canonical_record"
    | "legacy_operator_record";
  lifecycle:
    | "observed"
    | "configured"
    | "published"
    | "active"
    | "submitted"
    | "confirmed";
  financialReadiness:
    "not_applicable" | "setup_required" | "ready" | "submitted" | "confirmed";
  blocker?: string;
};

export type ProviderPreference =
  "open" | "preferred" | "selected" | "invite_only";

export type MarketplaceOpportunity = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  type: OpportunityType;
  status: string;
  creator: {
    type: OpportunityCreatorType;
    id?: string;
    name: string;
    avatar?: string;
    verified: boolean;
  };
  community?: { id?: string; name: string };
  pool?: { id?: string; name: string };
  projectId?: string;
  repository?: string;
  category?: string;
  skills: string[];
  deliverables: string[];
  evidenceRequirements: string[];
  eligibility: string[];
  reward?: {
    amountUsd?: number;
    token?: string;
    network?: string;
  };
  funding?: {
    fundedAmountUsd?: number;
    pendingAmountUsd?: number;
    goalAmountUsd?: number;
    status?: FundingStatus;
    source?: string;
    paymentMode?: string;
    distributionMethod?: string;
    amountState?: FundingAmountState;
  };
  provider: {
    preference: ProviderPreference;
    preferred?: { id: string; name: string };
    selected?: { id: string; name: string };
  };
  applicationCount?: number;
  capacity?: number;
  deadline?: string;
  location?: string;
  remote?: boolean;
  estimatedDelivery?: string;
  publishedAt: string;
  updatedAt: string;
  verificationStatus: string;
  riskFlags: string[];
  source: {
    type: string;
    id: string;
  };
  marketplaceKind?:
    "opportunity" | "verified_work" | "pool" | "program" | "outcome";
  program?: {
    id: string;
    name: string;
    templateId: string;
  };
  sourceUrl?: string;
  entityState?: DiscoverEntityState;
  primaryAction?: DiscoverAction;
  secondaryActions?: DiscoverAction[];
};

export type DiscoverSourceFailure = {
  source: string;
  requestId: string;
  message: string;
  retryable: boolean;
  lastSuccessfulAt?: string;
};

export type MarketplacePage<T> = {
  items: T[];
  nextCursor: string | null;
  total: number;
  failures: DiscoverSourceFailure[];
  generatedAt: string;
};

export type DiscoverPerson = {
  id: string;
  name: string;
  kind: "human" | "agent" | "creator" | "maintainer";
  avatar?: string;
  description?: string;
  verifiedIdentities: string[];
  skills: string[];
  communities: string[];
  available?: boolean;
  completedWork?: number;
  verifiedOutcomes?: number;
  amountEarnedUsd?: number;
  acceptsDirectFunding: boolean;
  acceptsInvitations: boolean;
  identityState:
    | "identity_verified"
    | "work_attribution_verified"
    | "profile_claimed"
    | "unclaimed_contributor";
  payoutReadiness: "ready" | "setup_required" | "invite_to_claim";
  blocker?: string;
  primaryAction: DiscoverAction;
  secondaryActions: DiscoverAction[];
  profilePath?: string;
  latestReceiptPath?: string;
};

export type DiscoverCommunity = {
  id: string;
  slug: string;
  name: string;
  purpose: string;
  type: string;
  founder?: string;
  memberCount?: number;
  activeOpportunities?: number;
  activePools?: number;
  publicFundingUsd?: number;
  governanceType?: string;
  verified: boolean;
  recentActivity?: string;
};

export type DiscoverPool = {
  id: string;
  name: string;
  owner: string;
  communitySlug: string;
  purpose?: string;
  type: string;
  balanceUsd?: number;
  committedUsd?: number;
  availableUsd?: number;
  token?: string;
  network?: string;
  eligibleOpportunityTypes: OpportunityType[];
  applicationModel?: string;
  governanceModel?: string;
  deadline?: string;
  fundedOutcomes?: number;
  funderCount?: number;
  verificationMechanism?: string;
  balanceState?: FundingAmountState;
  targetUsd?: number;
  pendingDepositsUsd?: number;
  lifecycleState:
    | "setup_incomplete"
    | "configured"
    | "published"
    | "accepting_funding"
    | "funding_pending"
    | "funded"
    | "checkpoint_pending"
    | "ready_for_distribution"
    | "distribution_submitted"
    | "completed"
    | "paused";
  publicationState: "legacy_active" | "approved" | "operator_review_required";
  policyState: "active" | "legacy_configured" | "setup_required";
  treasuryReadiness: "ready" | "setup_required";
  blocker?: string;
  primaryAction: DiscoverAction;
  secondaryActions: DiscoverAction[];
};

export type DiscoverMyCommunity = {
  id: string;
  slug: string;
  name: string;
  role: "owner" | "operator" | "member";
  status: string;
  sourceState: string;
  repositories: string[];
  programCount: number;
  activeProgramCount: number;
  poolCount: number;
  programId?: string;
  blocker?: string;
  primaryAction: DiscoverAction;
  secondaryActions: DiscoverAction[];
};

export type DiscoverInboxItem = {
  id: string;
  audience: "contributor" | "funder" | "operator";
  title: string;
  why: string;
  state: string;
  blocker?: string;
  occurredAt?: string;
  primaryAction: DiscoverAction;
  secondaryActions: DiscoverAction[];
};

export type DiscoverActivityKind =
  | "work"
  | "funding"
  | "claim"
  | "pool"
  | "transaction"
  | "receipt"
  | "program"
  | "account";

export type DiscoverActivityItem = {
  id: string;
  kind: DiscoverActivityKind;
  title: string;
  description: string;
  state: string;
  occurredAt: string;
  amountUsd?: number;
  token?: string;
  community?: string;
  repository?: string;
  primaryAction?: DiscoverAction;
};

export type DiscoverForYouProjection = {
  kind: "for_you";
  recommendation: DiscoverInboxItem | null;
  attention: DiscoverInboxItem[];
  pools: DiscoverPool[];
  people: DiscoverPerson[];
  inProgress: DiscoverActivityItem[];
  recent: DiscoverActivityItem[];
};

export type DiscoverExploreProjection = {
  kind: "explore";
  category: DiscoverExploreKind;
  people: DiscoverPerson[];
  work: MarketplaceOpportunity[];
  pools: DiscoverPool[];
  programs: MarketplaceOpportunity[];
  communities: DiscoverCommunity[];
  outcomes: MarketplaceOpportunity[];
};

export type DiscoverMyActivityProjection = {
  kind: "activity";
  items: DiscoverActivityItem[];
  summary: Partial<Record<DiscoverActivityKind | "in_progress", number>>;
};

export type DiscoverOutcomesProjection = {
  kind: "outcomes";
  items: MarketplaceOpportunity[];
};

export type DiscoverProjection =
  | DiscoverForYouProjection
  | DiscoverExploreProjection
  | DiscoverMyActivityProjection
  | DiscoverOutcomesProjection;

export type EconomicActionSubjectType =
  | "accepted_work"
  | "contributor"
  | "creator"
  | "community"
  | "funding_gap"
  | "community_pool"
  | "active_program"
  | "claim"
  | "authorization"
  | "settlement"
  | "receipt"
  | "source_failure"
  | "identity_blocker"
  | "payout_blocker"
  | "policy_blocker"
  | "reconciliation_issue";

export type EconomicLifecycle =
  | "observed"
  | "evidence_verified"
  | "attribution_required"
  | "identity_required"
  | "policy_required"
  | "treasury_required"
  | "ready_for_funding"
  | "authorization_required"
  | "submitted"
  | "confirmed"
  | "stale"
  | "blocked";

export type EconomicActionItem = {
  id: string;
  subjectType: EconomicActionSubjectType;
  subjectId: string;
  headline: string;
  happened: string;
  whyItMatters: string;
  lifecycle: EconomicLifecycle;
  blocker?: string;
  audience: "public" | "contributor" | "funder" | "operator";
  community?: { id?: string; name: string };
  repository?: string;
  person?: { id?: string; name: string };
  source: {
    provider: string;
    label: string;
    href?: string;
    lastObservedAt?: string;
    stale: boolean;
  };
  evidenceIds: string[];
  attributionState:
    "verified" | "claimed" | "observed" | "unresolved" | "not_applicable";
  programId?: string;
  policyState?: "active" | "approval_required" | "missing" | "not_applicable";
  poolId?: string;
  obligationId?: string;
  settlementId?: string;
  receiptId?: string;
  amount?: {
    valueUsd?: number;
    token?: string;
    state: FundingAmountState;
  };
  poolDetails?: {
    type: string;
    owner: string;
    purpose?: string;
    confirmedBalanceUsd?: number;
    pendingDepositsUsd?: number;
    availableBalanceUsd?: number;
    targetUsd?: number;
    policyState: DiscoverPool["policyState"];
    treasuryReadiness: DiscoverPool["treasuryReadiness"];
    distributionMethod?: string;
    network?: string;
  };
  fundingReadiness: "ready" | "blocked" | "not_applicable";
  recipientReadiness: "ready" | "setup_required" | "not_applicable";
  primaryAction: DiscoverAction;
  secondaryActions: DiscoverAction[];
  visibility: "public" | "private" | "community";
  createdAt: string;
  updatedAt: string;
};

export type DiscoverSourceDiagnostic = {
  id: string;
  provider: string;
  repository?: string;
  state: string;
  evaluationPeriod: string;
  eventsInspected: number | null;
  acceptedEvents: number;
  lastSuccessfulAt: string | null;
  reason: string;
  stale: boolean;
  primaryAction: DiscoverAction;
  secondaryActions: DiscoverAction[];
};

export type DiscoverNetworkStats = {
  openOpportunities?: number;
  activeFundingUsd?: number;
  activeCommunities?: number;
  verifiedContributors?: number;
};

export type DiscoverPageData = {
  view: DiscoverView;
  projection: DiscoverProjection;
  opportunities: MarketplacePage<MarketplaceOpportunity>;
  people: DiscoverPerson[];
  communities: DiscoverCommunity[];
  myCommunities: DiscoverMyCommunity[];
  pools: DiscoverPool[];
  inbox: DiscoverInboxItem[];
  economicActions: EconomicActionItem[];
  sourceDiagnostics: DiscoverSourceDiagnostic[];
  savedIds: string[];
  signedIn: boolean;
  capabilities: string[];
  stats: DiscoverNetworkStats;
  readiness: {
    githubState: string;
    repositoryState: string;
    walletState: string;
    selectedWallet: string | null;
    installedCommunitySlugs: string[];
    stale: boolean;
    lastConfirmedAt: string | null;
    repositories: string[];
  } | null;
  recommendation: {
    id: string;
    title: string;
    reason: string;
    state: string;
    primaryAction: DiscoverAction;
    secondaryActions: DiscoverAction[];
  };
  actions: {
    directSupport: boolean;
    poolFunding: boolean;
    verifiedWorkFunding: boolean;
  };
};
import type { ResolveActionId } from "@/lib/actions/types";
