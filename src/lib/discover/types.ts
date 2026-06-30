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
  amountNeededUsd: number;
  moneyCanMoveUsd: number;
  peopleImpacted: number;
  trendScore: number;
  entityPath?: string;
  communitySlug?: string;
  programId?: string;
  templateId?: string;
  missionId?: string;
  actions: DiscoverAction[];
};

export type DiscoverSearchResult = {
  id: string;
  kind: "community" | "repository" | "program" | "entity" | "domain";
  label: string;
  subtitle: string;
  entityPath?: string;
  communitySlug?: string;
  programId?: string;
  templateId?: string;
  actions: DiscoverAction[];
};
