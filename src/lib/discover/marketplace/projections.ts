import type {
  DiscoverActivityItem,
  DiscoverCommunity,
  DiscoverExploreKind,
  DiscoverInboxItem,
  DiscoverPerson,
  DiscoverPool,
  DiscoverProjection,
  MarketplaceOpportunity,
} from "./contracts";

type ProjectionInput = {
  view: DiscoverProjection["kind"];
  category: DiscoverExploreKind;
  inbox: DiscoverInboxItem[];
  people: DiscoverPerson[];
  pools: DiscoverPool[];
  communities: DiscoverCommunity[];
  opportunities: MarketplaceOpportunity[];
  activity: DiscoverActivityItem[];
};

export function isVerifiedWork(item: MarketplaceOpportunity) {
  return item.marketplaceKind === "verified_work" ||
    item.source.type === "github_evidence" ||
    item.source.type === "repository_snapshot";
}

export function isConfirmedOutcome(item: MarketplaceOpportunity) {
  return item.marketplaceKind === "outcome" &&
    item.source.type === "confirmed_receipt" &&
    item.entityState?.lifecycle === "confirmed" &&
    item.primaryAction?.presentation.kind === "workbench" &&
    item.primaryAction.presentation.target.panel === "receipt";
}

export function isProgram(item: MarketplaceOpportunity) {
  return item.marketplaceKind === "program" && item.source.type === "community_program";
}

function activitySummary(items: DiscoverActivityItem[]) {
  const summary: Record<string, number> = {};
  for (const item of items) {
    summary[item.kind] = (summary[item.kind] ?? 0) + 1;
    if (["prepared", "submitted", "pending", "awaiting_confirmation"].includes(item.state)) {
      summary.in_progress = (summary.in_progress ?? 0) + 1;
    }
  }
  return summary;
}

function opportunityActivity(item: MarketplaceOpportunity): DiscoverActivityItem {
  const work = isVerifiedWork(item);
  const outcome = isConfirmedOutcome(item);
  return {
    id: `marketplace:${item.id}`,
    kind: outcome ? "receipt" : work ? "work" : "program",
    title: item.title,
    description: work
      ? `${item.creator.name} in ${item.repository ?? item.community?.name ?? "a verified source"}`
      : item.summary,
    state: outcome ? "confirmed" : item.verificationStatus,
    occurredAt: item.updatedAt,
    amountUsd: outcome ? item.funding?.fundedAmountUsd : undefined,
    token: outcome ? item.reward?.token ?? "USDC" : undefined,
    community: item.community?.name,
    repository: item.repository,
    primaryAction: item.primaryAction,
  };
}

export function buildDiscoverProjection(input: ProjectionInput): DiscoverProjection {
  const work = input.opportunities.filter(isVerifiedWork);
  const programs = input.opportunities.filter(isProgram);
  const outcomes = input.opportunities.filter(isConfirmedOutcome);

  if (input.view === "outcomes") {
    return { kind: "outcomes", items: outcomes };
  }

  if (input.view === "activity") {
    return {
      kind: "activity",
      items: input.activity,
      summary: activitySummary(input.activity),
    };
  }

  if (input.view === "explore") {
    return {
      kind: "explore",
      category: input.category,
      people: input.people,
      work,
      pools: input.pools,
      programs,
      communities: input.communities,
      outcomes,
    };
  }

  const actionFirstInbox = input.inbox.filter(
    (item) =>
      item.id !== "operator:no-accepted-work" &&
      !item.id.startsWith("operator:pool-setup:"),
  );
  const recommendation = actionFirstInbox[0] ?? null;
  const recommendationId = recommendation?.id;
  const attention = actionFirstInbox
    .filter((item) => item.id !== recommendationId && Boolean(item.blocker))
    .slice(0, 4);
  const readyPools = input.pools
    .filter((pool) => pool.lifecycleState === "accepting_funding")
    .slice(0, 3);
  const readyPeople = input.people
    .filter((person) => person.acceptsDirectFunding && person.payoutReadiness === "ready")
    .slice(0, 4);
  const inProgress = input.activity
    .filter((item) => ["prepared", "submitted", "pending", "awaiting_confirmation"].includes(item.state))
    .slice(0, 4);
  const recent = [...work, ...outcomes]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5)
    .map(opportunityActivity);

  return {
    kind: "for_you",
    recommendation,
    attention,
    pools: readyPools,
    people: readyPeople,
    inProgress,
    recent,
  };
}
