export type DiscoverDataSource =
  | "github"
  | "musicbrainz"
  | "openalex"
  | "arc"
  | "supabase_ledger"
  | "catalog_preview"
  | "local_seed";

export type DiscoverIntent = "earn" | "fund" | "operate" | "build" | "sponsor" | "all";

export type DiscoverActionKind =
  | "fund"
  | "install"
  | "claim"
  | "open"
  | "create_program"
  | "connect_sensor"
  | "sponsor"
  | "share"
  | "analyze";

export type DiscoverAction = {
  id: string;
  label: string;
  kind: DiscoverActionKind;
  href?: string;
  programId?: string;
  missionId?: string;
  communitySlug?: string;
  templateId?: string;
  entityPath?: string;
  amountUsd?: number;
};

export type TrendingValueGap = {
  id: string;
  domain: "oss" | "music" | "research" | "dao" | "community" | "protocol";
  headline: string;
  why: string;
  whoBenefits: string;
  proofSource: string;
  /** Primary data provenance for this card */
  dataSource: DiscoverDataSource;
  /** True when amountUsd comes from ledger/API proof — not heuristic estimates */
  amountVerified: boolean;
  /** Ledger vs modeled estimate — defaults from amountVerified when omitted */
  amountKind?: "ledger" | "estimate";
  /** YouTube-style threshold copy for estimated amounts */
  eligibilityCriteria?: string;
  /** Ledger connector that produced this gap, when applicable */
  proofConnectorId?: string;
  /** Supabase authorization row id, when applicable */
  proofAuthorizationId?: string;
  /** ISO timestamp of live GitHub scan, when applicable */
  proofGithubScanAt?: string;
  amountNeededUsd: number;
  moneyCanMoveUsd: number;
  peopleImpacted: number;
  trendScore: number;
  entityPath?: string;
  communitySlug?: string;
  programId?: string;
  templateId?: string;
  missionId?: string;
  updatedAt?: string;
  proofHref?: string;
  actions: DiscoverAction[];
};

export type RadarEmptyState = {
  id: "oss" | "music" | "dao";
  title: string;
  message: string;
  actionLabel: string;
  actionHref: string;
};

export type DomainRadarId = "oss" | "music" | "dao";

/** Vertical mini-product — cards + always-on toolbar actions */
export type DomainRadarBundle = {
  id: DomainRadarId;
  title: string;
  tagline: string;
  cards: TrendingValueGap[];
  toolbar: DiscoverAction[];
  emptyState: RadarEmptyState;
  hasLiveData: boolean;
};

export type DiscoverRadarFeedPayload = {
  ok: boolean;
  error?: string;
  /** True when one or more upstream sources failed but payload is still usable */
  degraded?: boolean;
  degradedParts?: string[];
  gaps: TrendingValueGap[];
  radars: {
    oss: TrendingValueGap[];
    music: TrendingValueGap[];
    dao: TrendingValueGap[];
  };
  domainRadars: {
    oss: DomainRadarBundle;
    music: DomainRadarBundle;
    dao: DomainRadarBundle;
  };
  emptyStates: RadarEmptyState[];
  intelligence: import("@/lib/workspace/intelligence").NetworkIntelligence | null;
  fundableCount: number;
  ossSignalCount: number;
  realSignalCount: number;
  githubScanAt: string | null;
  claimHint: {
    claimableUsd: number;
    claimableCount: number;
    href: string;
    payeeLabel: string;
  } | null;
  updatedAt: string;
};

export type DiscoverSearchResult = {
  id: string;
  kind: "community" | "repository" | "program" | "entity" | "domain";
  label: string;
  subtitle: string;
  dataSource: DiscoverDataSource;
  amountVerified?: boolean;
  amountUsd?: number;
  entityPath?: string;
  communitySlug?: string;
  programId?: string;
  templateId?: string;
  actions: DiscoverAction[];
};

export type ActionAuditStatus = "idle" | "pending" | "success" | "blocked" | "error";

export type ActionAuditEntry = {
  id: string;
  surface: string;
  label: string;
  actionType: DiscoverActionKind;
  requiredAuth: boolean;
  requiredData: string[];
  apiEndpoint: string | null;
  currentStatus: ActionAuditStatus;
  blocker?: string;
  timestamp: string;
};
