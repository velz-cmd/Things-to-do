import "server-only";

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { COMMUNITY_CATALOG } from "@/lib/communities/catalog";
import { getSessionUser } from "@/lib/auth/session";
import {
  normalizeCampaignOpportunity,
  normalizePersistedOpportunity,
  normalizeProgramOpportunity,
  type CampaignOpportunityRow,
  type PersistedOpportunityRow,
  type ProgramOpportunityRow,
} from "./normalize";
import type {
  DiscoverCommunity,
  DiscoverPageData,
  DiscoverPerson,
  DiscoverPool,
  DiscoverSourceFailure,
  MarketplaceOpportunity,
  MarketplacePage,
} from "./contracts";
import type { OpportunityFilters } from "./filters";

const SOURCE_TIMEOUT_MS = 4_000;
const PAGE_SIZE = 18;
const SOURCE_LIMIT = 100;

function withTimeout<T>(promise: Promise<T>, ms = SOURCE_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Source timed out after ${ms}ms`)), ms);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

function sourceFailure(source: string, requestId: string, error: unknown): DiscoverSourceFailure {
  const message = error instanceof Error ? error.message : "Source request failed";
  return {
    source,
    requestId,
    message,
    retryable: /timed out|timeout|connect|unavailable|relation .* does not exist/i.test(message),
  };
}

async function loadPersistedOpportunities() {
  const rows = await prisma.discoverOpportunity.findMany({
    where: {
      visibility: "public",
      status: { in: ["published", "open", "active"] },
      publishedAt: { not: null, lte: new Date() },
      AND: [
        { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        { OR: [{ deadline: null }, { deadline: { gt: new Date() } }] },
      ],
    },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: SOURCE_LIMIT,
  });
  return rows.map((row) =>
    normalizePersistedOpportunity(row as PersistedOpportunityRow),
  );
}

async function loadProgramOpportunities() {
  const rows = await prisma.resolveProgram.findMany({
    where: {
      status: { in: ["active", "deployed"] },
      missionId: { not: null },
    },
    select: {
      id: true,
      name: true,
      templateId: true,
      status: true,
      budgetUsd: true,
      rulesJson: true,
      metadataJson: true,
      missionId: true,
      lastDeployAt: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          displayName: true,
          githubUsername: true,
        },
      },
      install: {
        select: {
          communitySlug: true,
        },
      },
      fundStakes: {
        where: { status: { in: ["active", "target_met"] } },
        select: {
          principalUsd: true,
          releasedUsd: true,
          status: true,
        },
      },
    },
    orderBy: [{ lastDeployAt: "desc" }, { createdAt: "desc" }],
    take: SOURCE_LIMIT,
  });
  return rows.map((row) =>
    normalizeProgramOpportunity(row as ProgramOpportunityRow),
  );
}

async function loadCampaignOpportunities() {
  const now = new Date();
  const campaigns = await prisma.outcomeCampaign.findMany({
    where: {
      status: "active",
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
    select: {
      id: true,
      assetId: true,
      creatorUserId: true,
      name: true,
      objective: true,
      contributionType: true,
      verificationAdapterId: true,
      totalBudgetMicroUsdc: true,
      committedMicroUsdc: true,
      participantCapMicroUsdc: true,
      startsAt: true,
      endsAt: true,
      publishedAt: true,
      updatedAt: true,
    },
    orderBy: { publishedAt: "desc" },
    take: SOURCE_LIMIT,
  });
  if (!campaigns.length) return [];

  const [assets, users] = await Promise.all([
    prisma.creatorAsset.findMany({
      where: {
        id: { in: campaigns.map((campaign) => campaign.assetId).filter(Boolean) },
        ownershipState: "verified",
      },
      select: { id: true, title: true, canonicalUrl: true },
    }),
    prisma.user.findMany({
      where: { id: { in: campaigns.map((campaign) => campaign.creatorUserId) } },
      select: { id: true, displayName: true, githubUsername: true },
    }),
  ]);
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
  const usersById = new Map(users.map((user) => [user.id, user]));

  return campaigns.flatMap((campaign) => {
    const asset = assetsById.get(campaign.assetId);
    if (!asset) return [];
    const creator = usersById.get(campaign.creatorUserId);
    return [
      normalizeCampaignOpportunity({
        ...campaign,
        asset,
        creatorName: creator?.displayName ?? creator?.githubUsername,
      } as CampaignOpportunityRow),
    ];
  });
}

export function deduplicateMarketplaceOpportunities(items: MarketplaceOpportunity[]) {
  const seenSources = new Set<string>();
  const seenSlugs = new Set<string>();
  return items.filter((item) => {
    const source = `${item.source.type}:${item.source.id}`;
    if (seenSources.has(source) || seenSlugs.has(item.slug)) return false;
    seenSources.add(source);
    seenSlugs.add(item.slug);
    return true;
  });
}

async function addMarketplaceActivity(items: MarketplaceOpportunity[]) {
  if (!items.length) return items;
  const [selections, applicationCounts] = await Promise.all([
    prisma.discoverProviderSelection.findMany({
      where: {
        opportunityId: { in: items.map((item) => item.id) },
        status: { in: ["preferred", "selected"] },
      },
      orderBy: { createdAt: "desc" },
      select: {
        opportunityId: true,
        providerId: true,
        providerName: true,
        status: true,
      },
    }),
    prisma.discoverApplication.groupBy({
      by: ["opportunityId"],
      where: {
        opportunityId: { in: items.map((item) => item.id) },
        status: { not: "withdrawn" },
      },
      _count: { _all: true },
    }),
  ]);
  const selectionByOpportunity = new Map<
    string,
    (typeof selections)[number]
  >();
  for (const selection of selections) {
    if (!selectionByOpportunity.has(selection.opportunityId)) {
      selectionByOpportunity.set(selection.opportunityId, selection);
    }
  }
  const applicationsByOpportunity = new Map(
    applicationCounts.map((row) => [row.opportunityId, row._count._all]),
  );
  return items.map((item) => {
    const selection = selectionByOpportunity.get(item.id);
    return {
      ...item,
      applicationCount: applicationsByOpportunity.get(item.id) ?? item.applicationCount,
      provider: selection
        ? {
            preference: selection.status === "selected" ? "selected" as const : "preferred" as const,
            preferred:
              selection.status === "preferred"
                ? { id: selection.providerId, name: selection.providerName }
                : undefined,
            selected:
              selection.status === "selected"
                ? { id: selection.providerId, name: selection.providerName }
                : undefined,
          }
        : item.provider,
    };
  });
}

export function marketplaceOpportunityMatches(
  item: MarketplaceOpportunity,
  filters: OpportunityFilters,
) {
  const searchable = [
    item.title,
    item.summary,
    item.creator.name,
    item.community?.name,
    item.repository,
    item.projectId,
    item.type,
    ...item.skills,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const q = filters.q?.toLowerCase();
  if (q && !searchable.includes(q)) return false;
  if (filters.type && item.type !== filters.type) return false;
  if (
    filters.category &&
    item.category?.toLowerCase() !== filters.category.toLowerCase()
  ) return false;
  if (
    filters.skill &&
    !item.skills.some((skill) => skill.toLowerCase() === filters.skill?.toLowerCase())
  ) return false;
  const reward = item.reward?.amountUsd;
  if (filters.minReward != null && (reward == null || reward < filters.minReward)) return false;
  if (filters.maxReward != null && (reward == null || reward > filters.maxReward)) return false;
  if (filters.token && item.reward?.token?.toLowerCase() !== filters.token.toLowerCase()) return false;
  if (
    filters.network &&
    item.reward?.network?.toLowerCase() !== filters.network.toLowerCase()
  ) return false;
  if (filters.fundingStatus && item.funding?.status !== filters.fundingStatus) return false;
  if (
    filters.community &&
    item.community?.id?.toLowerCase() !== filters.community.toLowerCase() &&
    item.community?.name.toLowerCase() !== filters.community.toLowerCase()
  ) return false;
  if (filters.creatorType && item.creator.type !== filters.creatorType) return false;
  if (filters.provider && item.provider.preference !== filters.provider) return false;
  if (filters.remote && item.remote !== true) return false;
  if (filters.verification && item.verificationStatus !== filters.verification) return false;
  if (filters.deadline) {
    if (!item.deadline) return false;
    const limit = Date.now() + (filters.deadline === "week" ? 7 : 30) * 86_400_000;
    if (new Date(item.deadline).getTime() > limit) return false;
  }
  return true;
}

export function sortMarketplaceOpportunities(
  items: MarketplaceOpportunity[],
  filters: OpportunityFilters,
) {
  return [...items].sort((a, b) => {
    if (filters.sort === "closing_soon") {
      const aDeadline = a.deadline ? new Date(a.deadline).getTime() : Number.MAX_SAFE_INTEGER;
      const bDeadline = b.deadline ? new Date(b.deadline).getTime() : Number.MAX_SAFE_INTEGER;
      return aDeadline - bDeadline || b.publishedAt.localeCompare(a.publishedAt);
    }
    if (filters.sort === "most_funded") {
      return (
        (b.funding?.fundedAmountUsd ?? -1) - (a.funding?.fundedAmountUsd ?? -1) ||
        b.publishedAt.localeCompare(a.publishedAt)
      );
    }
    if (filters.sort === "most_active") {
      return (
        (b.applicationCount ?? 0) - (a.applicationCount ?? 0) ||
        b.publishedAt.localeCompare(a.publishedAt)
      );
    }
    return b.publishedAt.localeCompare(a.publishedAt) || b.id.localeCompare(a.id);
  });
}

function decodeCursor(cursor?: string) {
  if (!cursor) return 0;
  try {
    const parsed = Number(Buffer.from(cursor, "base64url").toString("utf8"));
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function encodeCursor(offset: number) {
  return Buffer.from(String(offset)).toString("base64url");
}

export function paginateMarketplaceOpportunities(
  items: MarketplaceOpportunity[],
  cursor?: string,
  pageSize = PAGE_SIZE,
) {
  const offset = decodeCursor(cursor);
  const pageItems = items.slice(offset, offset + pageSize);
  const nextOffset = offset + pageItems.length;
  return {
    items: pageItems,
    nextCursor: nextOffset < items.length ? encodeCursor(nextOffset) : null,
  };
}

export function collectMarketplaceSourceResults(
  sources: string[],
  settled: PromiseSettledResult<MarketplaceOpportunity[]>[],
  requestId: string,
) {
  const failures: DiscoverSourceFailure[] = [];
  const items: MarketplaceOpportunity[] = [];
  settled.forEach((result, index) => {
    if (result.status === "fulfilled") items.push(...result.value);
    else failures.push(sourceFailure(sources[index] ?? "unknown", requestId, result.reason));
  });
  return { items, failures };
}

export async function listMarketplaceOpportunities(
  filters: OpportunityFilters,
  pageSize = PAGE_SIZE,
): Promise<MarketplacePage<MarketplaceOpportunity>> {
  const requestId = randomUUID();
  const loaders = [
    { source: "published_opportunities", promise: withTimeout(loadPersistedOpportunities()) },
    { source: "community_programs", promise: withTimeout(loadProgramOpportunities()) },
    { source: "outcome_campaigns", promise: withTimeout(loadCampaignOpportunities()) },
  ];
  const settled = await Promise.allSettled(loaders.map((loader) => loader.promise));
  const { items: loaded, failures } = collectMarketplaceSourceResults(
    loaders.map((loader) => loader.source),
    settled,
    requestId,
  );

  let unique = deduplicateMarketplaceOpportunities(loaded);
  try {
    unique = await withTimeout(addMarketplaceActivity(unique), 1_500);
  } catch (error) {
    failures.push(sourceFailure("marketplace_activity", requestId, error));
  }

  const filtered = sortMarketplaceOpportunities(
    unique.filter((item) => marketplaceOpportunityMatches(item, filters)),
    filters,
  );
  const page = paginateMarketplaceOpportunities(filtered, filters.cursor, pageSize);

  return {
    items: page.items,
    nextCursor: page.nextCursor,
    total: filtered.length,
    failures,
    generatedAt: new Date().toISOString(),
  };
}

export async function getMarketplaceOpportunityById(id: string) {
  const page = await listMarketplaceOpportunities({ sort: "newest" }, 300);
  return page.items.find((item) => item.id === id) ?? null;
}

export async function getMarketplaceOpportunityBySlug(slug: string) {
  const page = await listMarketplaceOpportunities({ sort: "newest" }, 300);
  return {
    opportunity: page.items.find((item) => item.slug === slug) ?? null,
    failures: page.failures,
    requestId: page.failures[0]?.requestId ?? randomUUID(),
  };
}

export async function listDiscoverPeople(): Promise<DiscoverPerson[]> {
  const [contributors, agents] = await Promise.all([
    prisma.contributorRegistry.findMany({
      where: { verified: true },
      orderBy: [{ totalEarnedUsd: "desc" }, { updatedAt: "desc" }],
      take: 40,
      select: {
        id: true,
        creatorName: true,
        githubUsername: true,
        musicbrainzId: true,
        activitypubActor: true,
        totalEarnedUsd: true,
        platform: true,
      },
    }),
    prisma.resolveAgent.findMany({
      where: { agentTokenId: { not: null } },
      take: 20,
      select: {
        id: true,
        agentTokenId: true,
        reputationCount: true,
      },
    }),
  ]);

  return [
    ...contributors.map((person) => ({
      id: person.id,
      name: person.creatorName ?? person.githubUsername ?? "Verified contributor",
      kind: (person.musicbrainzId ? "creator" : "human") as "creator" | "human",
      verifiedIdentities: [
        person.githubUsername ? "GitHub" : null,
        person.musicbrainzId ? "MusicBrainz" : null,
        person.activitypubActor ? "ActivityPub" : null,
      ].filter((value): value is string => Boolean(value)),
      skills: person.platform ? [person.platform] : [],
      communities: [],
      amountEarnedUsd: person.totalEarnedUsd > 0 ? person.totalEarnedUsd : undefined,
      acceptsDirectFunding: false,
      acceptsInvitations: true,
    })),
    ...agents.map((agent) => ({
      id: agent.id,
      name: agent.id === "resolve" ? "RESOLVE Agent" : agent.id,
      kind: "agent" as const,
      description: `Verified onchain agent ${agent.agentTokenId}.`,
      verifiedIdentities: ["ERC-8004"],
      skills: [],
      communities: [],
      verifiedOutcomes: agent.reputationCount || undefined,
      acceptsDirectFunding: false,
      acceptsInvitations: true,
    })),
  ];
}

function listCommunities(opportunities: MarketplaceOpportunity[]): DiscoverCommunity[] {
  return COMMUNITY_CATALOG.map((community) => {
    const matching = opportunities.filter(
      (item) => item.community?.id === community.slug,
    );
    const pools = new Set(matching.map((item) => item.pool?.id).filter(Boolean));
    const publicFunding = matching.reduce(
      (total, item) => total + (item.funding?.fundedAmountUsd ?? 0),
      0,
    );
    return {
      id: community.slug,
      slug: community.slug,
      name: community.name,
      purpose: community.tagline,
      type: community.kind,
      activeOpportunities: matching.length || undefined,
      activePools: pools.size || undefined,
      publicFundingUsd: publicFunding > 0 ? publicFunding : undefined,
      verified: true,
    };
  });
}

function listPools(opportunities: MarketplaceOpportunity[]): DiscoverPool[] {
  return opportunities.flatMap((item) => {
    if (!item.pool || !item.community) return [];
    const balance = item.funding?.fundedAmountUsd;
    const goal = item.funding?.goalAmountUsd;
    return [
      {
        id: item.pool.id ?? item.source.id,
        name: item.pool.name,
        owner: item.creator.name,
        communitySlug: item.community.id ?? item.community.name,
        purpose: item.summary,
        type: "community_pool",
        balanceUsd: balance,
        committedUsd: balance,
        availableUsd:
          balance != null && goal != null ? Math.max(0, balance - goal) : undefined,
        token: item.reward?.token,
        network: item.reward?.network,
        eligibleOpportunityTypes: [item.type],
        applicationModel:
          item.provider.preference === "invite_only" ? "Invite only" : "Open applications",
        verificationMechanism:
          item.evidenceRequirements.length > 0 ? item.evidenceRequirements[0] : undefined,
      },
    ];
  });
}

async function loadSavedIds(userId: string | null) {
  if (!userId) return [];
  try {
    const saved = await withTimeout(
      prisma.discoverSavedItem.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { targetId: true },
      }),
      1_500,
    );
    return saved.map((item) => item.targetId);
  } catch {
    return [];
  }
}

export async function loadDiscoverPageData(
  filters: OpportunityFilters,
  view: DiscoverPageData["view"],
): Promise<DiscoverPageData> {
  const opportunitiesPromise = listMarketplaceOpportunities(filters);
  const userPromise = withTimeout(getSessionUser().catch(() => null), 1_000).catch(() => null);
  const peoplePromise =
    view === "people" ? withTimeout(listDiscoverPeople()).catch(() => []) : Promise.resolve([]);
  const [opportunities, user, people] = await Promise.all([
    opportunitiesPromise,
    userPromise,
    peoplePromise,
  ]);
  const allVisible = opportunities.items;
  const savedIds = await loadSavedIds(user?.id ?? null);
  const communities = listCommunities(allVisible);
  const pools = listPools(allVisible);
  const activeFundingUsd = allVisible.reduce(
    (total, item) => total + (item.funding?.fundedAmountUsd ?? 0),
    0,
  );

  return {
    view,
    opportunities,
    people,
    communities,
    pools,
    savedIds,
    signedIn: Boolean(user),
    stats: {
      openOpportunities: opportunities.total || undefined,
      activeFundingUsd: activeFundingUsd > 0 ? activeFundingUsd : undefined,
      activeCommunities: communities.length || undefined,
      verifiedContributors: people.length || undefined,
    },
  };
}
