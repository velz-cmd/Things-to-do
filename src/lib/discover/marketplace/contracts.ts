export const DISCOVER_VIEWS = [
  "opportunities",
  "people",
  "communities",
  "pools",
  "saved",
] as const;

export type DiscoverView = (typeof DISCOVER_VIEWS)[number];

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
  | "unfunded"
  | "partially_funded"
  | "funded"
  | "escrowed"
  | "milestone_funded";

export type ProviderPreference =
  | "open"
  | "preferred"
  | "selected"
  | "invite_only";

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
    goalAmountUsd?: number;
    status?: FundingStatus;
    source?: string;
    paymentMode?: string;
    distributionMethod?: string;
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
};

export type DiscoverNetworkStats = {
  openOpportunities?: number;
  activeFundingUsd?: number;
  activeCommunities?: number;
  verifiedContributors?: number;
};

export type DiscoverPageData = {
  view: DiscoverView;
  opportunities: MarketplacePage<MarketplaceOpportunity>;
  people: DiscoverPerson[];
  communities: DiscoverCommunity[];
  pools: DiscoverPool[];
  savedIds: string[];
  signedIn: boolean;
  stats: DiscoverNetworkStats;
};
