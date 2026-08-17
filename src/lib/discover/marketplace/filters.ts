import {
  DISCOVER_VIEWS,
  DISCOVER_INTENTS,
  DISCOVER_ROUTE_TO_VIEW,
  type DiscoverIntent,
  type DiscoverExploreKind,
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
  repository?: string;
  creatorType?: OpportunityCreatorType;
  provider?: ProviderPreference;
  remote?: boolean;
  deadline?: "week" | "month";
  verification?: string;
  sort: OpportunitySort;
  cursor?: string;
  kind?: DiscoverExploreKind;
  intent?: DiscoverIntent;
};

const PRIMARY_EXPLORE_KINDS: readonly DiscoverExploreKind[] = [
  "all",
  "work",
  "people",
  "pools",
];

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

/**
 * True legacy aliases only - param values that are NOT one of the five
 * canonical DiscoverRouteView names. Canonical names are resolved first,
 * below, via DISCOVER_ROUTE_TO_VIEW - the one place that mapping is
 * declared - so this table can never redefine what a canonical ID means.
 * (It once contained "activity" and "pools" as hand-duplicated entries;
 * because "activity" is also the internal DiscoverView id used for Pools,
 * that duplication silently pointed the canonical Activity route at the
 * wrong content the moment the two definitions drifted.)
 */
const LEGACY_VIEW_ALIASES: Record<string, DiscoverView> = {
  opportunities: "for_you",
  people: "explore",
  work: "explore",
  agent_marketplace: "agents",
  services: "agents",
  communities: "activity",
  my_communities: "activity",
  programs: "explore",
  saved: "for_you",
};

export function parseDiscoverView(value: SearchValue): DiscoverView {
  const candidate = first(value);
  if (!candidate) return "for_you";
  const canonical = (DISCOVER_ROUTE_TO_VIEW as Record<string, DiscoverView>)[candidate];
  if (canonical) return canonical;
  if (LEGACY_VIEW_ALIASES[candidate]) return LEGACY_VIEW_ALIASES[candidate];
  // Last resort: an old bookmark using an internal DiscoverView id directly
  // (pre-dating DiscoverRouteView). Preserved so those links keep working.
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
  const requestedView = clean(params.view, 40);
  const requestedKind = clean(params.kind, 40) ??
    ({ people: "people", work: "work", pools: "pools" } as const)[
      requestedView as "people" | "work" | "pools"
    ];
  const requestedIntent = clean(params.intent, 20);

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
    repository: clean(params.repository, 160),
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
    kind: PRIMARY_EXPLORE_KINDS.includes(requestedKind as DiscoverExploreKind)
      ? (requestedKind as DiscoverExploreKind)
      : "all",
    intent: DISCOVER_INTENTS.includes(requestedIntent as DiscoverIntent)
      ? (requestedIntent as DiscoverIntent)
      : "explore",
  };
}

export function hasActiveOpportunityFilters(filters: OpportunityFilters) {
  return Object.entries(filters).some(
    ([key, value]) =>
      key !== "sort" &&
      key !== "cursor" &&
      key !== "kind" &&
      key !== "intent" &&
      value !== undefined &&
      value !== "",
  );
}
