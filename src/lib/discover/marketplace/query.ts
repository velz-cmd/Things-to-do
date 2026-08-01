import "server-only";

import { randomUUID } from "node:crypto";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { cacheGetOrSetResilient } from "@/lib/cache/kv";
import { COMMUNITY_CATALOG } from "@/lib/communities/catalog";
import { getSessionUser } from "@/lib/auth/session";
import { loadWorkspaceReadiness } from "@/lib/workspace/readiness";
import { isLiveArcEnabled } from "@/lib/settlement/arc-config";
import { buildLiveSettlements } from "@/lib/discover/live-settlements";
import { loadStoredOssOpportunities } from "@/lib/github/oss-scan-store";
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
  DiscoverInboxItem,
  DiscoverMyCommunity,
  DiscoverPageData,
  DiscoverPerson,
  DiscoverPool,
  DiscoverSourceFailure,
  DiscoverView,
  MarketplaceOpportunity,
  MarketplacePage,
} from "./contracts";
import type { OpportunityFilters } from "./filters";
import {
  opportunityMatchesView,
  programEntityVisible,
} from "./publication";
import { selectDiscoverRecommendation } from "./recommendation";
import { DISCOVER_MARKETPLACE_SOURCE_CACHE_KEYS } from "./cache";
import {
  normalizeConfirmedOutcomes,
  normalizeGithubAcceptedWork,
} from "./read-model";

const SOURCE_TIMEOUT_MS = 4_000;
const COLD_DATABASE_SOURCE_TIMEOUT_MS = 7_500;
const MARKETPLACE_ACTIVITY_TIMEOUT_MS = 1_000;
export const DISCOVER_MARKETPLACE_CACHE_TAG = "discover-marketplace-sources";
export const DISCOVER_MARKETPLACE_ACTIVITY_CACHE_TAG =
  "discover-marketplace-activity";
const PAGE_SIZE = 18;
const SOURCE_LIMIT = 100;
const SOURCE_CACHE_SECONDS = 60;
const ACTIVITY_CACHE_SECONDS = 30;

type ConfirmedFundingRow = { total_micro_usdc: bigint | null };

function withTimeout<T>(promise: Promise<T>, ms = SOURCE_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Source timed out after ${ms}ms`)), ms);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

export function confirmedFundingUsd(totalMicroUsdc: bigint | null | undefined) {
  if (totalMicroUsdc == null || totalMicroUsdc <= 0n) return undefined;
  return Number(totalMicroUsdc) / 1_000_000;
}

async function loadConfirmedFundingUsd() {
  const rows = await prisma.$queryRaw<ConfirmedFundingRow[]>`
    SELECT COALESCE(SUM(r."totalUsdcMicro"), 0)::bigint AS total_micro_usdc
    FROM "Receipt" r
    INNER JOIN "ChainTransaction" t
      ON t.id = r."chainTransactionId"
    WHERE t.status = 'confirmed'
      AND t."txHash" IS NOT NULL
      AND t."confirmedAt" IS NOT NULL
      AND t."fromAddress" IS NOT NULL
      AND t."toAddress" IS NOT NULL
      AND t."amountUsdcMicro" IS NOT NULL
  `;
  return confirmedFundingUsd(rows[0]?.total_micro_usdc);
}

function sourceFailure(source: string, requestId: string, error: unknown): DiscoverSourceFailure {
  const message = error instanceof Error ? error.message : "Source request failed";
  return {
    source,
    requestId,
    message: /timed out|timeout/i.test(message)
      ? "The source refresh timed out. Last confirmed results remain available when present."
      : /permission|forbidden/i.test(message)
        ? "The source is connected, but required permission is missing."
        : "The source could not refresh. Other confirmed sources remain available.",
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
          githubId: true,
        },
      },
      install: {
        select: {
          communitySlug: true,
          status: true,
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
  return rows
    .filter((row) => programEntityVisible(row as ProgramOpportunityRow))
    .map((row) => normalizeProgramOpportunity(row as ProgramOpportunityRow));
}

async function loadVerifiedGithubWork() {
  const stored = await loadStoredOssOpportunities();
  return normalizeGithubAcceptedWork(stored.opportunities);
}

async function loadConfirmedOutcomes() {
  const settlements = await buildLiveSettlements(24);
  return normalizeConfirmedOutcomes(settlements.rows);
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

function loadCachedPersistedOpportunities() {
  return cacheGetOrSetResilient(
    DISCOVER_MARKETPLACE_SOURCE_CACHE_KEYS.published,
    SOURCE_CACHE_SECONDS,
    loadPersistedOpportunities,
    { staleSeconds: 86_400 },
  );
}

function loadCachedProgramOpportunities() {
  return cacheGetOrSetResilient(
    DISCOVER_MARKETPLACE_SOURCE_CACHE_KEYS.programs,
    SOURCE_CACHE_SECONDS,
    loadProgramOpportunities,
    { staleSeconds: 86_400 },
  );
}

function loadCachedCampaignOpportunities() {
  return cacheGetOrSetResilient(
    DISCOVER_MARKETPLACE_SOURCE_CACHE_KEYS.campaigns,
    SOURCE_CACHE_SECONDS,
    loadCampaignOpportunities,
    { staleSeconds: 86_400 },
  );
}

function loadCachedVerifiedGithubWork() {
  return cacheGetOrSetResilient(
    DISCOVER_MARKETPLACE_SOURCE_CACHE_KEYS.githubWork,
    SOURCE_CACHE_SECONDS,
    () => withTimeout(loadVerifiedGithubWork(), COLD_DATABASE_SOURCE_TIMEOUT_MS),
    { staleSeconds: 86_400 },
  );
}

function loadCachedConfirmedOutcomes() {
  return cacheGetOrSetResilient(
    DISCOVER_MARKETPLACE_SOURCE_CACHE_KEYS.outcomes,
    SOURCE_CACHE_SECONDS,
    () => withTimeout(loadConfirmedOutcomes(), COLD_DATABASE_SOURCE_TIMEOUT_MS),
    { staleSeconds: 86_400 },
  );
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

const addCachedMarketplaceActivity = unstable_cache(
  addMarketplaceActivity,
  ["discover-marketplace-activity-v1"],
  {
    revalidate: ACTIVITY_CACHE_SECONDS,
    tags: [DISCOVER_MARKETPLACE_ACTIVITY_CACHE_TAG],
  },
);

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
  view: DiscoverView = "for_you",
): Promise<MarketplacePage<MarketplaceOpportunity>> {
  const requestId = randomUUID();
  const loaders: Array<{ source: string; promise: Promise<MarketplaceOpportunity[]> }> = [];
  if (view !== "people" && view !== "my_communities") {
    loaders.push({
      source: "published_opportunities",
      promise: loadCachedPersistedOpportunities(),
    });
  }
  if (view === "for_you" || view === "pools") {
    loaders.push({
      source: "community_programs",
      promise: loadCachedProgramOpportunities(),
    });
  }
  if (view === "for_you") {
    loaders.push({
      source: "outcome_campaigns",
      promise: loadCachedCampaignOpportunities(),
    });
  }
  if (view === "for_you" || view === "work") {
    loaders.push({
      source: "verified_github_work",
      promise: loadCachedVerifiedGithubWork(),
    });
  }
  if (view === "for_you" || view === "outcomes") {
    loaders.push({
      source: "confirmed_outcomes",
      promise: loadCachedConfirmedOutcomes(),
    });
  }
  const settled = await Promise.allSettled(loaders.map((loader) => loader.promise));
  const { items: loaded, failures } = collectMarketplaceSourceResults(
    loaders.map((loader) => loader.source),
    settled,
    requestId,
  );

  let unique = deduplicateMarketplaceOpportunities(loaded);
  try {
    unique = await withTimeout(
      addCachedMarketplaceActivity(unique),
      MARKETPLACE_ACTIVITY_TIMEOUT_MS,
    );
  } catch (error) {
    failures.push(sourceFailure("marketplace_activity", requestId, error));
  }

  const filtered = sortMarketplaceOpportunities(
    unique.filter(
      (item) =>
        marketplaceOpportunityMatches(item, filters) &&
        opportunityMatchesView(item, view),
    ),
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
  const page = await listMarketplaceOpportunities({ sort: "newest" }, 300, "for_you");
  return page.items.find((item) => item.id === id) ?? null;
}

export async function getMarketplaceOpportunityBySlug(slug: string) {
  const page = await listMarketplaceOpportunities({ sort: "newest" }, 300, "for_you");
  return {
    opportunity: page.items.find((item) => item.slug === slug) ?? null,
    failures: page.failures,
    requestId: page.failures[0]?.requestId ?? randomUUID(),
  };
}

export async function listDiscoverPeople(viewerUserId?: string): Promise<DiscoverPerson[]> {
  const users = await prisma.user.findMany({
    where: {
      githubUsername: { not: null },
      githubId: { not: null },
      OR: [
        { communityInstalls: { some: { status: "active" } } },
        { resolvePrograms: { some: { status: { in: ["active", "deployed"] } } } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 40,
    select: {
      id: true,
      displayName: true,
      githubUsername: true,
      communityInstalls: {
        where: { status: "active" },
        select: { communitySlug: true },
      },
      resolvePrograms: {
        where: { status: { in: ["active", "deployed"] } },
        select: { id: true },
      },
    },
  });
  const userIds = users.map((user) => user.id);
  const payouts = userIds.length
    ? await prisma.payoutDestination.findMany({
        where: {
          userId: { in: userIds },
          status: "verified",
          verifiedAt: { not: null },
        },
        orderBy: { verifiedAt: "desc" },
        select: { userId: true },
      })
    : [];
  const payoutReady = new Set(
    payouts.map((payout) => payout.userId).filter((id): id is string => Boolean(id)),
  );

  return users.map((person) => {
    const payoutIsReady = payoutReady.has(person.id);
    const directSupportReady = payoutIsReady && isLiveArcEnabled();
    const isSelf = viewerUserId === person.id;
    const github = person.githubUsername!;
    const profilePath = `https://github.com/${encodeURIComponent(github)}`;
    const returnTo = `/discover?view=people&person=${encodeURIComponent(person.id)}`;
    return {
      id: person.id,
      name: person.displayName ?? github,
      kind: person.resolvePrograms.length ? "maintainer" : "human",
      description: `GitHub-linked ${person.resolvePrograms.length ? "community operator" : "contributor"} @${github}`,
      verifiedIdentities: ["GitHub"],
      skills: ["GitHub"],
      communities: [...new Set(person.communityInstalls.map((item) => item.communitySlug))],
      completedWork: undefined,
      acceptsDirectFunding: directSupportReady,
      acceptsInvitations: !payoutIsReady,
      identityState: "profile_claimed",
      payoutReadiness: payoutIsReady ? "ready" : "setup_required",
      blocker: !payoutIsReady
        ? "No verified payout destination is recorded."
        : directSupportReady
          ? undefined
          : "Direct support is blocked until the live Arc settlement gate is enabled.",
      primaryAction: directSupportReady
        ? {
            id: "capital.open_funding",
            label: "Support with USDC",
            href: `/capital?intent=direct-support&recipient=${encodeURIComponent(person.id)}&returnTo=${encodeURIComponent(returnTo)}`,
            enabled: true,
          }
        : isSelf && !payoutIsReady
          ? {
              id: "discover.resolve_identity",
              label: "Complete payout setup",
              href: `/profile?view=wallets&returnTo=${encodeURIComponent(returnTo)}`,
              enabled: true,
            }
          : {
              id: "discover.open_repository",
              label: "View GitHub profile",
              href: profilePath,
              enabled: true,
            },
      secondaryActions: directSupportReady
        ? [
            {
              id: "discover.open_repository",
              label: "View GitHub profile",
              href: profilePath,
              enabled: true,
            },
          ]
        : [],
      profilePath,
    } satisfies DiscoverPerson;
  });
}

function repositoryNames(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const object = value as Record<string, unknown>;
  const candidates = [
    object.repositories,
    object.selectedRepositories,
    object.repositoryNames,
  ];
  return candidates.flatMap((candidate) =>
    Array.isArray(candidate)
      ? candidate
          .map((item) => {
            if (typeof item === "string") return item;
            if (item && typeof item === "object" && !Array.isArray(item)) {
              const row = item as Record<string, unknown>;
              return typeof row.fullName === "string"
                ? row.fullName
                : typeof row.name === "string"
                  ? row.name
                  : null;
            }
            return null;
          })
          .filter((item): item is string => Boolean(item))
      : [],
  );
}

export async function listMyDiscoverCommunities(
  userId: string,
): Promise<DiscoverMyCommunity[]> {
  const [installs, sources, repositorySnapshots] = await Promise.all([
    prisma.resolveCommunityInstall.findMany({
      where: { userId, status: "active" },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        communitySlug: true,
        status: true,
        programs: {
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            status: true,
            templateId: true,
            rulesJson: true,
            metadataJson: true,
          },
        },
      },
    }),
    prisma.sourceConnection.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: {
        provider: true,
        status: true,
        communitySlug: true,
        displayLabel: true,
        externalAccountId: true,
        capabilitiesJson: true,
        lastSyncedAt: true,
      },
    }),
    prisma.discoverRepositorySnapshot.findMany({
      orderBy: { observedAt: "desc" },
      distinct: ["fullName"],
      take: 50,
      select: { fullName: true },
    }),
  ]);

  return installs.map((install) => {
    const catalog = COMMUNITY_CATALOG.find((item) => item.slug === install.communitySlug);
    const relevantSources = sources.filter(
      (source) =>
        !source.communitySlug || source.communitySlug === install.communitySlug,
    );
    const githubSource = relevantSources.find((source) => source.provider === "github_app") ??
      relevantSources.find((source) => source.provider === "github");
    const repositories = [
      ...new Set([
        ...relevantSources.flatMap((source) => repositoryNames(source.capabilitiesJson)),
        ...(catalog?.connectors.includes("github") && githubSource
          ? repositorySnapshots.map((snapshot) => snapshot.fullName)
          : []),
        ...(githubSource?.externalAccountId?.includes("/")
          ? [githubSource.externalAccountId]
          : []),
      ]),
    ];
    const activePrograms = install.programs.filter((program) =>
      ["active", "deployed"].includes(program.status),
    );
    const githubPrograms = activePrograms.filter((program) => {
      try {
        const rules = JSON.parse(program.rulesJson) as Record<string, unknown>;
        return rules.connectorId === "github";
      } catch {
        return false;
      }
    });
    const sourceConnected = githubSource &&
      ["connected", "healthy", "syncing", "stale"].includes(githubSource.status);
    const sourceState = githubSource?.status ?? "not_configured";
    const blocker = !sourceConnected
      ? "Connect or repair GitHub repository access."
      : activePrograms.length === 0
        ? "Create a program for accepted activity."
        : githubPrograms.length === 0
          ? "No active program uses the supported GitHub adapter."
          : "Review legacy policy publication and treasury setup.";
    return {
      id: install.id,
      slug: install.communitySlug,
      name: catalog?.name ?? install.communitySlug,
      role: "operator",
      status: install.status,
      sourceState,
      repositories,
      programCount: install.programs.length,
      activeProgramCount: activePrograms.length,
      poolCount: githubPrograms.length,
      blocker,
      primaryAction: {
        id: sourceConnected ? "community.open" : "profile.manage_connections",
        label: sourceConnected ? "Review programs and Pools" : "Manage GitHub access",
        href: sourceConnected
          ? `/communities/${encodeURIComponent(install.communitySlug)}?returnTo=${encodeURIComponent("/discover?view=my_communities")}#programs`
          : `/profile?section=connections&returnTo=${encodeURIComponent(`/discover?view=my_communities`)}`,
        enabled: true,
      },
      secondaryActions: sourceConnected
        ? []
        : [
            {
              id: "community.open",
              label: "Open operator console",
              href: `/communities/${encodeURIComponent(install.communitySlug)}?returnTo=${encodeURIComponent("/discover?view=my_communities")}`,
              enabled: true,
            },
          ],
    } satisfies DiscoverMyCommunity;
  });
}

function listCommunities(opportunities: MarketplaceOpportunity[]): DiscoverCommunity[] {
  return COMMUNITY_CATALOG.flatMap((community) => {
    const matching = opportunities.filter(
      (item) => item.community?.id === community.slug,
    );
    if (!matching.length) return [];
    const pools = new Set(matching.map((item) => item.pool?.id).filter(Boolean));
    const publicFunding = matching.reduce(
      (total, item) => total + (item.funding?.fundedAmountUsd ?? 0),
      0,
    );
    return [{
      id: community.slug,
      slug: community.slug,
      name: community.name,
      purpose: community.tagline,
      type: community.kind,
      activeOpportunities: matching.length || undefined,
      activePools: pools.size || undefined,
      publicFundingUsd: publicFunding > 0 ? publicFunding : undefined,
      verified: true,
    }];
  });
}

function listPools(opportunities: MarketplaceOpportunity[]): DiscoverPool[] {
  return opportunities.flatMap((item) => {
    if (!item.pool || !item.community) return [];
    const confirmed = item.funding?.amountState === "confirmed";
    const balance = confirmed ? item.funding?.fundedAmountUsd ?? 0 : 0;
    const target = item.funding?.goalAmountUsd;
    const pendingDeposits = item.funding?.pendingAmountUsd;
    const financiallyReady = item.entityState?.financialReadiness === "ready";
    const executionReady = financiallyReady && isLiveArcEnabled();
    const publicationState =
      item.entityState?.lifecycle === "published" ? "approved" : "legacy_active";
    return [
      {
        id: item.pool.id ?? item.source.id,
        name: item.pool.name,
        owner: item.creator.name,
        communitySlug: item.community.id ?? item.community.name,
        purpose: item.summary,
        type: "community_pool",
        balanceUsd: balance,
        committedUsd: confirmed ? balance : undefined,
        availableUsd: confirmed ? balance : 0,
        token: item.reward?.token,
        network: item.reward?.network,
        eligibleOpportunityTypes: [item.type],
        applicationModel:
          item.provider.preference === "invite_only" ? "Invite only" : "Open applications",
        verificationMechanism:
          item.evidenceRequirements.length > 0 ? item.evidenceRequirements[0] : undefined,
        balanceState: item.funding?.amountState,
        targetUsd: target,
        pendingDepositsUsd: pendingDeposits,
        lifecycleState: executionReady
          ? "accepting_funding"
          : financiallyReady
            ? "published"
            : "setup_incomplete",
        publicationState,
        policyState: financiallyReady ? "active" : "legacy_configured",
        treasuryReadiness: financiallyReady ? "ready" : "setup_required",
        blocker:
          financiallyReady && !executionReady
            ? "Live Arc settlement is not enabled for this Pool."
            : item.entityState?.blocker,
        primaryAction:
          executionReady
            ? item.primaryAction ?? {
                id: "capital.open_funding",
                label: "Review funding package",
                href: `/capital?intent=back-pool&programId=${encodeURIComponent(item.pool.id ?? item.source.id)}&returnTo=${encodeURIComponent("/discover?view=pools")}`,
                enabled: true,
              }
            : {
            id: "community.open",
            label: financiallyReady ? "Review settlement readiness" : "Complete Pool setup",
            href: `/communities/${encodeURIComponent(item.community.id ?? item.community.name)}?program=${encodeURIComponent(item.pool.id ?? item.source.id)}&returnTo=${encodeURIComponent(`/discover?view=pools&pool=${item.pool.id ?? item.source.id}`)}#programs`,
            enabled: true,
          },
        secondaryActions: item.secondaryActions ?? [],
      },
    ];
  });
}

export function buildDiscoverInbox(input: {
  readiness: Awaited<ReturnType<typeof loadWorkspaceReadiness>> | null;
  opportunities: MarketplaceOpportunity[];
  people: DiscoverPerson[];
  pools: DiscoverPool[];
  myCommunities: DiscoverMyCommunity[];
}): DiscoverInboxItem[] {
  const items: DiscoverInboxItem[] = [];
  const { readiness, opportunities, people, pools, myCommunities } = input;

  if (
    readiness &&
    ["sync_failed", "permission_missing", "revoked"].includes(
      readiness.github.repositorySync.state,
    )
  ) {
    items.push({
      id: "operator:repair-github-sync",
      audience: "operator",
      title: "Repository access needs repair",
      why: "Accepted activity cannot be refreshed until GitHub repository access recovers.",
      state: readiness.github.repositorySync.state,
      blocker: readiness.github.repositorySync.errorCode ?? "Repository synchronization failed.",
      occurredAt: readiness.github.repositorySync.lastSuccessfulAt ?? undefined,
      primaryAction: {
        id: "profile.manage_connections",
        label: "Repair GitHub access",
        href: `/profile?section=connections&returnTo=${encodeURIComponent("/discover")}`,
        enabled: true,
      },
      secondaryActions: [],
    });
  }

  if (
    readiness &&
    ["connected", "syncing", "stale"].includes(readiness.github.repositoryAccess.state) &&
    !opportunities.some((item) => item.source.type === "github_evidence")
  ) {
    items.push({
      id: "operator:no-accepted-work",
      audience: "operator",
      title: "No accepted GitHub work is in the current snapshot",
      why: "Repository access is connected, but the persisted snapshot contains no merged pull request, review, documentation change, or release record.",
      state: readiness.github.repositorySync.state,
      blocker: "Refresh or select a repository with accepted activity.",
      occurredAt: readiness.github.repositorySync.lastSuccessfulAt ?? undefined,
      primaryAction: {
        id: "profile.open_source_details",
        label: "Review repository sync",
        href: `/profile?section=connections&returnTo=${encodeURIComponent("/discover?view=work")}`,
        enabled: true,
      },
      secondaryActions: [
        {
          id: "discover.open_verified_work",
          label: "Open Verified Work",
          href: "/discover?view=work",
          enabled: true,
        },
      ],
    });
  }

  const self = readiness ? people.find((person) => person.id === readiness.userId) : undefined;
  if (self && self.payoutReadiness !== "ready") {
    items.push({
      id: "contributor:complete-payout",
      audience: "contributor",
      title: "Complete payout readiness",
      why: "Your GitHub identity is recognised, but RESOLVE has no verified payout destination.",
      state: self.payoutReadiness,
      blocker: self.blocker,
      primaryAction: self.primaryAction,
      secondaryActions: [
        {
          id: "discover.open_verified_work",
          label: "View recognised work",
          href: "/discover?view=work",
          enabled: true,
        },
      ],
    });
  }

  for (const community of myCommunities.slice(0, 3)) {
    const hasPool = community.poolCount > 0;
    items.push({
      id: `operator:pool-setup:${community.id}`,
      audience: "operator",
      title: hasPool
        ? `${community.name} has ${community.poolCount} Pool ${community.poolCount === 1 ? "setup" : "setups"} to review`
        : `${community.name} needs its next supported program action`,
      why: hasPool
        ? "These are real operator-created GitHub programs. They remain visible while publication, policy, and treasury setup are completed."
        : "The community is installed. Its existing source and program state determine the next operator action.",
      state: "setup_required",
      blocker: community.blocker,
      primaryAction: community.primaryAction,
      secondaryActions: community.secondaryActions.slice(0, 2),
    });
  }

  if (readiness && readiness.capital.pendingAuthorizations > 0) {
    items.push({
      id: "funder:pending-authorizations",
      audience: "funder",
      title: `${readiness.capital.pendingAuthorizations} funding ${readiness.capital.pendingAuthorizations === 1 ? "package needs" : "packages need"} review`,
      why: "Persisted authorizations are obligations, not payments. Capital must preflight and submit them before confirmation.",
      state: "awaiting_authorization",
      primaryAction: {
        id: "capital.review_authorization",
        label: "Review in Capital",
        href: "/capital?view=authorizations&returnTo=/discover",
        enabled: true,
      },
      secondaryActions: [],
    });
  }

  const readyPool = pools.find((pool) => pool.lifecycleState === "accepting_funding");
  if (readyPool) {
    items.push({
      id: `funder:pool:${readyPool.id}`,
      audience: "funder",
      title: `${readyPool.name} is ready for funding review`,
      why: "The Pool has passed its publication, policy, and treasury prerequisites.",
      state: readyPool.lifecycleState,
      primaryAction: readyPool.primaryAction,
      secondaryActions: readyPool.secondaryActions.slice(0, 2),
    });
  }

  const readyPerson = people.find((person) => person.acceptsDirectFunding);
  if (readyPerson) {
    items.push({
      id: `funder:person:${readyPerson.id}`,
      audience: "funder",
      title: `${readyPerson.name} can receive direct support`,
      why: "Their identity and payout destination are verified.",
      state: "payout_ready",
      primaryAction: readyPerson.primaryAction,
      secondaryActions: readyPerson.secondaryActions.slice(0, 2),
    });
  }

  return items.slice(0, 8);
}

export async function loadDiscoverPageData(
  filters: OpportunityFilters,
  view: DiscoverPageData["view"],
): Promise<DiscoverPageData> {
  const opportunitiesPromise = listMarketplaceOpportunities(filters, PAGE_SIZE, view);
  const userPromise = withTimeout(getSessionUser().catch(() => null), 1_000).catch(() => null);
  const activeFundingPromise = withTimeout(loadConfirmedFundingUsd(), 1_500).catch(
    () => undefined,
  );
  const [opportunities, user, activeFundingUsd] = await Promise.all([
    opportunitiesPromise,
    userPromise,
    activeFundingPromise,
  ]);
  const peoplePromise =
    view === "people" || view === "for_you"
      ? withTimeout(listDiscoverPeople(user?.id), COLD_DATABASE_SOURCE_TIMEOUT_MS).catch(() => [])
      : Promise.resolve([]);
  const readinessPromise = user
    ? withTimeout(loadWorkspaceReadiness(user.id), 1_500).catch(() => null)
    : Promise.resolve(null);
  const myCommunitiesPromise = user
    ? withTimeout(listMyDiscoverCommunities(user.id), COLD_DATABASE_SOURCE_TIMEOUT_MS).catch(
        () => [],
      )
    : Promise.resolve([]);
  const [people, readiness, myCommunities] = await Promise.all([
    peoplePromise,
    readinessPromise,
    myCommunitiesPromise,
  ]);
  const allVisible = opportunities.items;
  const communities = listCommunities(allVisible);
  const pools = listPools(allVisible);
  const liveSettlementEnabled = isLiveArcEnabled();
  const inbox = buildDiscoverInbox({
    readiness,
    opportunities: allVisible,
    people,
    pools,
    myCommunities,
  });
  const fallbackRecommendation = selectDiscoverRecommendation(readiness, allVisible);
  const firstInbox = inbox[0];

  return {
    view,
    opportunities,
    people: filters.q
      ? people.filter((person) =>
          [
            person.name,
            ...person.verifiedIdentities,
            ...person.skills,
            ...person.communities,
          ]
            .join(" ")
            .toLowerCase()
            .includes(filters.q!.toLowerCase()),
        )
      : people,
    communities,
    myCommunities,
    pools,
    inbox,
    savedIds: [],
    signedIn: Boolean(user),
    stats: {
      openOpportunities: opportunities.total || undefined,
      activeFundingUsd,
      activeCommunities: communities.length || myCommunities.length || undefined,
      verifiedContributors: people.length || undefined,
    },
    readiness: readiness
      ? {
          githubState: readiness.github.personal.state,
          repositoryState: readiness.github.repositoryAccess.state,
          walletState: readiness.capital.state,
          selectedWallet: readiness.wallets.selectedAddress,
          installedCommunitySlugs: readiness.communities.map((item) => item.slug),
          stale: readiness.stale,
          lastConfirmedAt: readiness.lastSuccessfulAt,
          repositories: [
            ...new Set(myCommunities.flatMap((community) => community.repositories)),
          ],
        }
      : null,
    recommendation: firstInbox
      ? {
          id: firstInbox.id,
          title: firstInbox.title,
          reason: firstInbox.why,
          state: firstInbox.state,
          primaryAction: {
            id: firstInbox.primaryAction.id,
            label: firstInbox.primaryAction.label,
            href: firstInbox.primaryAction.href,
          },
          secondaryActions: firstInbox.secondaryActions.map((action) => ({
            id: action.id,
            label: action.label,
            href: action.href,
          })),
        }
      : fallbackRecommendation,
    actions: {
      directSupport:
        liveSettlementEnabled &&
        people.some(
          (person) => person.acceptsDirectFunding && person.payoutReadiness === "ready",
        ),
      poolFunding:
        liveSettlementEnabled &&
        pools.some((pool) => pool.lifecycleState === "accepting_funding"),
      verifiedWorkFunding:
        liveSettlementEnabled &&
        allVisible.some(
          (item) =>
            item.verificationStatus === "verified" &&
            (item.source.type === "repository_snapshot" ||
              ["project_contribution", "repository_fix"].includes(item.type)),
        ),
    },
  };
}
