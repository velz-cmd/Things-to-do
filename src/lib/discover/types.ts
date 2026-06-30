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
  /** True when amountUsd comes from a live API/ledger, not catalog preview */
  amountVerified: boolean;
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
