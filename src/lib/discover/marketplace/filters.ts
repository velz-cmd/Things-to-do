import {
  DISCOVER_VIEWS,
  OPPORTUNITY_TYPES,
  type DiscoverView,
  type FundingStatus,
  type OpportunityCreatorType,
  type OpportunityType,
  type ProviderPreference,
} from "./contracts";

type SearchValue = string | string[] | undefined;

export type DiscoverSearchParams = Record<string, SearchValue>;

export type OpportunitySort = "newest" | "closing_soon" | "most_funded" | "most_active";

export type OpportunityFilters = {
  q?: string;
  type?: OpportunityType;
  category?: string;
  skill?: string;
  minReward?: number;
  maxReward?: number;
  token?: string;
  network?: string;
  fundingStatus?: FundingStatus;
  community?: string;
  creatorType?: OpportunityCreatorType;
  provider?: ProviderPreference;
  remote?: boolean;
  deadline?: "week" | "month";
  verification?: string;
  sort: OpportunitySort;
  cursor?: string;
};

function first(value: SearchValue) {
  return Array.isArray(value) ? value[0] : value;
}

function clean(value: SearchValue, max = 120) {
  const text = first(value)?.trim();
  return text ? text.slice(0, max) : undefined;
}

function number(value: SearchValue) {
  const parsed = Number(first(value));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export function parseDiscoverView(value: SearchValue): DiscoverView {
  const candidate = first(value);
  const legacy: Record<string, DiscoverView> = {
    opportunities: "for_you",
    communities: "my_communities",
    programs: "pools",
    saved: "for_you",
  };
  if (candidate && legacy[candidate]) return legacy[candidate];
  return DISCOVER_VIEWS.includes(candidate as DiscoverView)
    ? (candidate as DiscoverView)
    : "for_you";
}

export function parseOpportunityFilters(params: DiscoverSearchParams): OpportunityFilters {
  const type = clean(params.type, 40);
  const fundingStatus = clean(params.funding, 40);
  const creatorType = clean(params.creator, 40);
  const provider = clean(params.provider, 40);
  const deadline = clean(params.deadline, 20);
  const sort = clean(params.sort, 30);

  return {
    q: clean(params.q),
    type: OPPORTUNITY_TYPES.includes(type as OpportunityType)
      ? (type as OpportunityType)
      : undefined,
    category: clean(params.category, 60),
    skill: clean(params.skill, 60),
    minReward: number(params.minReward),
    maxReward: number(params.maxReward),
    token: clean(params.token, 30),
    network: clean(params.network, 50),
    fundingStatus: [
      "unfunded",
      "partially_funded",
      "funded",
      "escrowed",
      "milestone_funded",
    ].includes(fundingStatus ?? "")
      ? (fundingStatus as FundingStatus)
      : undefined,
    community: clean(params.community, 80),
    creatorType: [
      "founder",
      "funder",
      "community",
      "dao",
      "individual",
      "creator",
      "maintainer",
      "agent",
      "organisation",
    ].includes(creatorType ?? "")
      ? (creatorType as OpportunityCreatorType)
      : undefined,
    provider: ["open", "preferred", "selected", "invite_only"].includes(provider ?? "")
      ? (provider as ProviderPreference)
      : undefined,
    remote: first(params.remote) === "true" ? true : undefined,
    deadline: deadline === "week" || deadline === "month" ? deadline : undefined,
    verification: clean(params.verification, 40),
    sort: ["newest", "closing_soon", "most_funded", "most_active"].includes(sort ?? "")
      ? (sort as OpportunitySort)
      : "newest",
    cursor: clean(params.cursor, 240),
  };
}

export function hasActiveOpportunityFilters(filters: OpportunityFilters) {
  return Object.entries(filters).some(
    ([key, value]) =>
      key !== "sort" &&
      key !== "cursor" &&
      value !== undefined &&
      value !== "",
  );
}
