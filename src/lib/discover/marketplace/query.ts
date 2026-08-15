import "server-only";

import { randomUUID } from "node:crypto";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import type { ResolveActionId } from "@/lib/actions/types";
import { cacheGetOrSetResilient } from "@/lib/cache/kv";
import { COMMUNITY_CATALOG } from "@/lib/communities/catalog";
import { getSessionUser } from "@/lib/auth/session";
import { loadWorkspaceReadiness } from "@/lib/workspace/readiness";
import type { WorkspaceReadiness } from "@/lib/workspace/readiness-contract";
import {
  getLiveBlockers,
  isLiveArcEnabled,
} from "@/lib/settlement/arc-config";
import { discoverAgentServices } from "@/lib/agent/commerce";
import { getAgentSignalService } from "@/lib/agent/service-registry";
import { buildLiveSettlements } from "@/lib/discover/live-settlements";
import { loadStoredOssOpportunities } from "@/lib/github/oss-scan-store";
import {
  normalizeCampaignOpportunity,
  normalizePersistedOpportunity,
  normalizeProgramOpportunity,
  programMarketplaceKind,
  type CampaignOpportunityRow,
  type PersistedOpportunityRow,
  type ProgramOpportunityRow,
} from "./normalize";
import type {
  DiscoverEntityState,
  DiscoverActivityItem,
  DiscoverCommunity,
  DiscoverInboxItem,
  DiscoverMyCommunity,
  DiscoverPageData,
  DiscoverPerson,
  DiscoverPool,
  DiscoverSourceFailure,
  DiscoverSourceDiagnostic,
  DiscoverView,
  MarketplaceOpportunity,
  MarketplacePage,
} from "./contracts";
import type { OpportunityFilters } from "./filters";
import {
  opportunityMatchesView,
  operatorProgramVisible,
  programEntityVisible,
} from "./publication";
import { selectDiscoverRecommendation } from "./recommendation";
import { DISCOVER_MARKETPLACE_SOURCE_CACHE_KEYS } from "./cache";
import {
  normalizeConfirmedOutcomes,
  normalizeGithubAcceptedWork,
} from "./read-model";
import {
  actionMatchesExploreKind,
  actionMatchesIntent,
  buildEconomicActions,
  rankEconomicActions,
} from "./economic-actions";
import {
  buildDiscoverProjection,
  isConfirmedOutcome,
  isProgram,
  isVerifiedWork,
} from "./projections";
import { deriveUserCapabilities } from "@/lib/capabilities/user-capabilities";
import { canonicalOutcomeHref } from "@/lib/discover/receipt-links";
import { explorerTxUrl } from "@/lib/settlement/arc-config";
import { discoverNavigationAction, workbenchAction } from "./action-contract";
import { computePoolMilestoneSegment } from "@/lib/capital/pool-milestone-progress";
import { fundStakeProvenanceAvailable } from "@/lib/db/ensure-fund-stake-arc-schema";
import { attachEconomicMatch } from "./attach-economic-match";
import { rankOpportunitiesForViewer, viewerRole } from "./role-ranked";

const SOURCE_TIMEOUT_MS = 4_000;
const COLD_DATABASE_SOURCE_TIMEOUT_MS = 7_500;
const GITHUB_EVIDENCE_SOURCE_TIMEOUT_MS = 15_000;
const MARKETPLACE_ACTIVITY_TIMEOUT_MS = 1_000;
export const DISCOVER_MARKETPLACE_CACHE_TAG = "discover-marketplace-sources";
export const DISCOVER_MARKETPLACE_ACTIVITY_CACHE_TAG =
  "discover-marketplace-activity";
const PAGE_SIZE = 18;
const SOURCE_LIMIT = 100;
const SOURCE_CACHE_SECONDS = 60;
const ACTIVITY_CACHE_SECONDS = 30;
const PERSONAL_ENRICHMENT_TIMEOUT_MS = 4_000;
const PERSONAL_ENRICHMENT_TIMEOUT_LABEL = `${PERSONAL_ENRICHMENT_TIMEOUT_MS / 1_000}-second personal-enrichment timeout`;
// Workspace readiness is an enhancement for recommendations. It must not hold
// the route longer than the persisted People and My Activity projections.
const PERSONAL_SOURCE_TIMEOUT_MS = PERSONAL_ENRICHMENT_TIMEOUT_MS;
const PERSONAL_SOURCE_TIMEOUT_LABEL = `${PERSONAL_SOURCE_TIMEOUT_MS / 1_000}-second personal-source timeout`;

type ConfirmedFundingRow = { total_micro_usdc: bigint | null };

function withTimeout<T>(
  promise: Promise<T>,
  ms = SOURCE_TIMEOUT_MS,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Source timed out after ${ms}ms`)),
      ms,
    );
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

function sourceFailure(
  source: string,
  requestId: string,
  error: unknown,
): DiscoverSourceFailure {
  const message =
    error instanceof Error ? error.message : "Source request failed";
  const diagnosticMessage = message
    .replace(/\b(?:postgres(?:ql)?|https?):\/\/\S+/gi, "[redacted-url]")
    .replace(/\b(?:vcp|sb_secret|sk)_[A-Za-z0-9_-]+\b/g, "[redacted-secret]")
    .slice(0, 500);
  console.error("[discover] source refresh failed", {
    source,
    requestId,
    errorName: error instanceof Error ? error.name : typeof error,
    errorCode:
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : null,
    message: diagnosticMessage,
  });
  return {
    source,
    requestId,
    message: /timed out|timeout/i.test(message)
      ? "The source refresh timed out. Last confirmed results remain available when present."
      : /permission|forbidden/i.test(message)
        ? "The source is connected, but required permission is missing."
        : "The source could not refresh. Other confirmed sources remain available.",
    retryable:
      /timed out|timeout|connect|unavailable|relation .* does not exist/i.test(
        message,
      ),
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
          // Selected only when the columns exist. The build never runs
          // migrations, so a projection that assumes them breaks the whole
          // surface on any deployment that has not healed yet.
          ...(await fundStakeProvenanceAvailable()
            ? { arcTxHash: true, confirmedAt: true }
            : {}),
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

/**
 * The operator's own Programs/Pools, regardless of status or mission
 * linkage — draft, undeployed setups that `loadProgramOpportunities`
 * deliberately excludes from the shared PUBLIC cache. Queried per-request
 * (never cached across viewers) so an operator can find and finish setting
 * up a Pool that isn't publicly fundable yet, matching how a request's own
 * unpublished drafts already stay visible to their creator only.
 */
async function loadOperatorProgramOpportunities(viewerId: string) {
  const rows = await prisma.resolveProgram.findMany({
    where: { userId: viewerId },
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
          // Selected only when the columns exist. The build never runs
          // migrations, so a projection that assumes them breaks the whole
          // surface on any deployment that has not healed yet.
          ...(await fundStakeProvenanceAvailable()
            ? { arcTxHash: true, confirmedAt: true }
            : {}),
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 40,
  });
  return rows
    .filter((row) => operatorProgramVisible(row as ProgramOpportunityRow))
    .map((row) => normalizeProgramOpportunity(row as ProgramOpportunityRow))
    .filter((item) => item.marketplaceKind === "pool");
}

async function loadVerifiedGithubWork() {
  const stored = await loadCachedStoredOssOpportunities();
  const subjectRefs = stored.opportunities.map(
    (opportunity) => `github:${opportunity.fullName.toLowerCase()}`,
  );
  if (!subjectRefs.length) return [];
  const evidence = await prisma.evidence.findMany({
    where: {
      subjectRef: { in: subjectRefs },
      kind: { startsWith: "github." },
    },
    select: {
      id: true,
      externalId: true,
      subjectRef: true,
      kind: true,
      sourceUrl: true,
    },
  });
  return normalizeGithubAcceptedWork(stored.opportunities, evidence);
}

function loadCachedStoredOssOpportunities() {
  return cacheGetOrSetResilient(
    DISCOVER_MARKETPLACE_SOURCE_CACHE_KEYS.githubStore,
    SOURCE_CACHE_SECONDS,
    loadStoredOssOpportunities,
    { staleSeconds: 86_400 },
  );
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
        id: {
          in: campaigns.map((campaign) => campaign.assetId).filter(Boolean),
        },
        ownershipState: "verified",
      },
      select: { id: true, title: true, canonicalUrl: true },
    }),
    prisma.user.findMany({
      where: {
        id: { in: campaigns.map((campaign) => campaign.creatorUserId) },
      },
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
    () =>
      withTimeout(
        loadPersistedOpportunities(),
        COLD_DATABASE_SOURCE_TIMEOUT_MS,
      ),
    { staleSeconds: 86_400 },
  );
}

function loadCachedProgramOpportunities() {
  return cacheGetOrSetResilient(
    DISCOVER_MARKETPLACE_SOURCE_CACHE_KEYS.programs,
    SOURCE_CACHE_SECONDS,
    () =>
      withTimeout(loadProgramOpportunities(), COLD_DATABASE_SOURCE_TIMEOUT_MS),
    { staleSeconds: 86_400 },
  );
}

function loadCachedCampaignOpportunities() {
  return cacheGetOrSetResilient(
    DISCOVER_MARKETPLACE_SOURCE_CACHE_KEYS.campaigns,
    SOURCE_CACHE_SECONDS,
    () =>
      withTimeout(loadCampaignOpportunities(), COLD_DATABASE_SOURCE_TIMEOUT_MS),
    { staleSeconds: 86_400 },
  );
}

function loadCachedVerifiedGithubWork() {
  return cacheGetOrSetResilient(
    DISCOVER_MARKETPLACE_SOURCE_CACHE_KEYS.githubWork,
    SOURCE_CACHE_SECONDS,
    () =>
      withTimeout(loadVerifiedGithubWork(), GITHUB_EVIDENCE_SOURCE_TIMEOUT_MS),
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

export function deduplicateMarketplaceOpportunities(
  items: MarketplaceOpportunity[],
) {
  const seenSources = new Set<string>();
  const seenSlugs = new Set<string>();
  const semanticIndexes = new Map<string, number>();
  const unique: MarketplaceOpportunity[] = [];

  const semanticKey = (item: MarketplaceOpportunity) => {
    if (item.marketplaceKind !== "pool" && item.marketplaceKind !== "program") {
      return null;
    }
    const community = (item.community?.id ?? item.community?.name ?? "")
      .trim()
      .toLocaleLowerCase();
    const title = item.title
      .normalize("NFKC")
      .trim()
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
    return community && title
      ? `${item.marketplaceKind}:${community}:${title}`
      : null;
  };

  const canonicalScore = (item: MarketplaceOpportunity) => {
    const provenance = {
      canonical_record: 40,
      operator_created: 35,
      external_integration: 30,
      legacy_operator_record: 20,
    }[item.entityState?.provenance ?? "legacy_operator_record"];
    const lifecycle = {
      confirmed: 30,
      published: 25,
      active: 20,
      submitted: 15,
      configured: 10,
      observed: 5,
    }[item.entityState?.lifecycle ?? "observed"];
    const financialReadiness = {
      confirmed: 20,
      ready: 15,
      submitted: 10,
      setup_required: 5,
      not_applicable: 0,
    }[item.entityState?.financialReadiness ?? "not_applicable"];
    const authoritativeFunding =
      item.funding?.amountState === "confirmed" ? 10 : 0;
    return provenance + lifecycle + financialReadiness + authoritativeFunding;
  };

  for (const item of items) {
    const source = `${item.source.type}:${item.source.id}`;
    if (seenSources.has(source) || seenSlugs.has(item.slug)) continue;
    seenSources.add(source);
    seenSlugs.add(item.slug);
    const key = semanticKey(item);
    const existingIndex = key ? semanticIndexes.get(key) : undefined;
    if (existingIndex == null) {
      if (key) semanticIndexes.set(key, unique.length);
      unique.push(item);
      continue;
    }
    const existing = unique[existingIndex];
    if (
      existing &&
      (canonicalScore(item) > canonicalScore(existing) ||
        (canonicalScore(item) === canonicalScore(existing) &&
          item.updatedAt.localeCompare(existing.updatedAt) > 0))
    ) {
      unique[existingIndex] = item;
    }
  }

  return unique;
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
  const selectionByOpportunity = new Map<string, (typeof selections)[number]>();
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
      applicationCount:
        applicationsByOpportunity.get(item.id) ?? item.applicationCount,
      provider: selection
        ? {
            preference:
              selection.status === "selected"
                ? ("selected" as const)
                : ("preferred" as const),
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
  )
    return false;
  if (
    filters.skill &&
    !item.skills.some(
      (skill) => skill.toLowerCase() === filters.skill?.toLowerCase(),
    )
  )
    return false;
  const reward = item.reward?.amountUsd;
  if (
    filters.minReward != null &&
    (reward == null || reward < filters.minReward)
  )
    return false;
  if (
    filters.maxReward != null &&
    (reward == null || reward > filters.maxReward)
  )
    return false;
  if (
    filters.token &&
    item.reward?.token?.toLowerCase() !== filters.token.toLowerCase()
  )
    return false;
  if (
    filters.network &&
    item.reward?.network?.toLowerCase() !== filters.network.toLowerCase()
  )
    return false;
  if (filters.fundingStatus && item.funding?.status !== filters.fundingStatus)
    return false;
  if (
    filters.community &&
    item.community?.id?.toLowerCase() !== filters.community.toLowerCase() &&
    item.community?.name.toLowerCase() !== filters.community.toLowerCase()
  )
    return false;
  if (
    filters.repository &&
    item.repository?.toLowerCase() !== filters.repository.toLowerCase()
  )
    return false;
  if (filters.creatorType && item.creator.type !== filters.creatorType)
    return false;
  if (filters.provider && item.provider.preference !== filters.provider)
    return false;
  if (filters.remote && item.remote !== true) return false;
  if (filters.verification && item.verificationStatus !== filters.verification)
    return false;
  if (filters.deadline) {
    if (!item.deadline) return false;
    const limit =
      Date.now() + (filters.deadline === "week" ? 7 : 30) * 86_400_000;
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
      const aDeadline = a.deadline
        ? new Date(a.deadline).getTime()
        : Number.MAX_SAFE_INTEGER;
      const bDeadline = b.deadline
        ? new Date(b.deadline).getTime()
        : Number.MAX_SAFE_INTEGER;
      return (
        aDeadline - bDeadline || b.publishedAt.localeCompare(a.publishedAt)
      );
    }
    if (filters.sort === "most_funded") {
      return (
        (b.funding?.fundedAmountUsd ?? -1) -
          (a.funding?.fundedAmountUsd ?? -1) ||
        b.publishedAt.localeCompare(a.publishedAt)
      );
    }
    if (filters.sort === "most_active") {
      return (
        (b.applicationCount ?? 0) - (a.applicationCount ?? 0) ||
        b.publishedAt.localeCompare(a.publishedAt)
      );
    }
    return (
      b.publishedAt.localeCompare(a.publishedAt) || b.id.localeCompare(a.id)
    );
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
    else
      failures.push(
        sourceFailure(sources[index] ?? "unknown", requestId, result.reason),
      );
  });
  return { items, failures };
}

export async function listMarketplaceOpportunities(
  filters: OpportunityFilters,
  pageSize = PAGE_SIZE,
  view: DiscoverView = "for_you",
): Promise<MarketplacePage<MarketplaceOpportunity>> {
  const requestId = randomUUID();
  const loaders: Array<{
    source: string;
    promise: Promise<MarketplaceOpportunity[]>;
  }> = [];
  if (view !== "outcomes") {
    loaders.push({
      source: "published_opportunities",
      promise: loadCachedPersistedOpportunities(),
    });
  }
  if (view !== "outcomes") {
    loaders.push({
      source: "community_programs",
      promise: loadCachedProgramOpportunities(),
    });
  }
  if (view !== "outcomes") {
    loaders.push({
      source: "outcome_campaigns",
      promise: loadCachedCampaignOpportunities(),
    });
  }
  if (view !== "outcomes") {
    loaders.push({
      source: "verified_github_work",
      promise: loadCachedVerifiedGithubWork(),
    });
  }
  if (["for_you", "explore", "activity", "outcomes"].includes(view)) {
    loaders.push({
      source: "confirmed_outcomes",
      promise: loadCachedConfirmedOutcomes(),
    });
  }
  const settled = await Promise.allSettled(
    loaders.map((loader) => loader.promise),
  );
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
  const page = paginateMarketplaceOpportunities(
    filtered,
    filters.cursor,
    pageSize,
  );

  return {
    items: page.items,
    nextCursor: page.nextCursor,
    total: filtered.length,
    failures,
    generatedAt: new Date().toISOString(),
  };
}

export async function getMarketplaceOpportunityById(id: string) {
  const page = await listMarketplaceOpportunities(
    { sort: "newest" },
    300,
    "for_you",
  );
  return page.items.find((item) => item.id === id) ?? null;
}

export async function getMarketplaceOpportunityBySlug(slug: string) {
  const page = await listMarketplaceOpportunities(
    { sort: "newest" },
    300,
    "for_you",
  );
  return {
    opportunity: page.items.find((item) => item.slug === slug) ?? null,
    failures: page.failures,
    requestId: page.failures[0]?.requestId ?? randomUUID(),
  };
}

export async function listDiscoverPeople(
  viewerUserId?: string,
): Promise<DiscoverPerson[]> {
  const users = await prisma.user.findMany({
    where: {
      githubUsername: { not: null },
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
  const actorRefs = users.flatMap((user) =>
    user.githubUsername ? [`github:${user.githubUsername.toLowerCase()}`] : [],
  );
  const [payouts, evidenceRows] = await Promise.all([
    userIds.length
      ? prisma.payoutDestination.findMany({
          where: {
            userId: { in: userIds },
            status: "verified",
            verifiedAt: { not: null },
            network: "ARC-TESTNET",
            asset: "USDC",
          },
          orderBy: { verifiedAt: "desc" },
          select: { userId: true },
        })
      : Promise.resolve([]),
    actorRefs.length
      ? prisma.evidence.findMany({
          where: {
            actorRef: { in: actorRefs },
            kind: { startsWith: "github.", not: "github.dependency.detected" },
            sourceUrl: { startsWith: "https://github.com/" },
          },
          select: { actorRef: true, externalId: true },
        })
      : Promise.resolve([]),
  ]);
  const payoutReady = new Set(
    payouts
      .map((payout) => payout.userId)
      .filter((id): id is string => Boolean(id)),
  );
  const evidenceIdsByActor = new Map<string, Set<string>>();
  for (const row of evidenceRows) {
    if (!row.actorRef) continue;
    const ids = evidenceIdsByActor.get(row.actorRef) ?? new Set<string>();
    ids.add(row.externalId);
    evidenceIdsByActor.set(row.actorRef, ids);
  }

  return users.map((person) => {
    const payoutIsReady = payoutReady.has(person.id);
    const isSelf = viewerUserId === person.id;
    const directSupportReady = !isSelf && payoutIsReady && isLiveArcEnabled();
    const github = person.githubUsername!;
    const completedWork =
      evidenceIdsByActor.get(`github:${github.toLowerCase()}`)?.size ?? 0;
    const profilePath = `https://github.com/${encodeURIComponent(github)}`;
    const returnTo = `/discover?view=verified_work&person=${encodeURIComponent(person.id)}`;
    return {
      id: person.id,
      name: person.displayName ?? github,
      kind: person.resolvePrograms.length ? "maintainer" : "human",
      description: `GitHub-linked ${person.resolvePrograms.length ? "community operator" : "contributor"} @${github}`,
      verifiedIdentities: [
        "GitHub identity verified",
        ...(completedWork > 0 ? ["Work attribution verified"] : []),
        ...(person.communityInstalls.length > 0
          ? ["Community role verified"]
          : []),
        "Public profile claimed",
      ],
      skills: ["GitHub"],
      communities: [
        ...new Set(person.communityInstalls.map((item) => item.communitySlug)),
      ],
      completedWork,
      acceptsDirectFunding: directSupportReady,
      acceptsInvitations: !payoutIsReady,
      identityState:
        completedWork > 0 ? "work_attribution_verified" : "profile_claimed",
      payoutReadiness: payoutIsReady ? "ready" : "setup_required",
      blocker: !payoutIsReady
        ? "No verified payout destination is recorded."
        : isSelf
          ? "Direct support to your own payout destination is unavailable."
          : directSupportReady
            ? undefined
            : "Direct support is blocked until the live Arc settlement gate is enabled.",
      primaryAction: directSupportReady
        ? workbenchAction(
            {
              id: "capital.open_funding",
              label: "Support with USDC",
              href: returnTo,
            },
            {
              panel: "direct_support",
              subjectId: person.id,
              recipientUserId: person.id,
              recipientLabel: person.displayName ?? github,
            },
            { requiresConfirmation: true },
          )
        : isSelf && !payoutIsReady
          ? workbenchAction(
              {
                id: "profile.set_payout_destination",
                label: "Choose payout wallet",
                href: returnTo,
              },
              { panel: "payout_destination", subjectId: person.id },
            )
          : discoverNavigationAction(
              {
                id: "discover.open_repository",
                label: "View GitHub profile",
                href: profilePath,
              },
              { target: "external" },
            ),
      secondaryActions: directSupportReady
        ? [
            discoverNavigationAction(
              {
                id: "discover.open_repository",
                label: "View GitHub profile",
                href: profilePath,
              },
              { target: "external", secondary: true },
            ),
          ]
        : [],
      profilePath,
    } satisfies DiscoverPerson;
  });
}

function loadCachedDiscoverPeople(viewerUserId?: string) {
  return cacheGetOrSetResilient(
    `discover:people:v2:${viewerUserId ?? "public"}`,
    60,
    () =>
      withTimeout(
        listDiscoverPeople(viewerUserId),
        PERSONAL_ENRICHMENT_TIMEOUT_MS,
      ),
    { staleSeconds: 86_400 },
  );
}

export function discoverPersonFromReadiness(
  readiness: WorkspaceReadiness,
  viewerUserId: string,
): DiscoverPerson | null {
  const githubAccount = readiness.github.personal.account
    ?.trim()
    .replace(/^@/, "");
  if (!githubAccount) return null;
  const payoutReady = readiness.wallets.payout.state === "connected";
  // This fallback always represents the current viewer. Direct support to the
  // sender's own payout destination is never a valid Discover action.
  const directSupportReady = false;
  const returnTo = `/discover?view=verified_work&person=${encodeURIComponent(viewerUserId)}`;
  const profilePath = `https://github.com/${encodeURIComponent(githubAccount)}`;
  return {
    id: viewerUserId,
    name: readiness.user.displayName ?? githubAccount,
    kind: readiness.programs.length ? "maintainer" : "human",
    description: `GitHub-linked ${readiness.programs.length ? "community operator" : "contributor"} @${githubAccount}`,
    verifiedIdentities: [
      "GitHub identity connected",
      ...(readiness.identities.verifiedCount > 0
        ? ["RESOLVE identity verified"]
        : []),
      "Public profile claimed",
    ],
    skills: ["GitHub"],
    communities: [...new Set(readiness.communities.map((item) => item.slug))],
    completedWork: 0,
    acceptsDirectFunding: directSupportReady,
    acceptsInvitations: !payoutReady,
    identityState:
      readiness.identities.verifiedCount > 0
        ? "identity_verified"
        : "profile_claimed",
    payoutReadiness: payoutReady ? "ready" : "setup_required",
    blocker: !payoutReady
      ? "No verified payout destination is recorded in the latest workspace snapshot."
      : "Direct support to your own payout destination is unavailable.",
    primaryAction: directSupportReady
      ? workbenchAction(
          {
            id: "capital.open_funding",
            label: "Support with USDC",
            href: returnTo,
          },
          {
            panel: "direct_support",
            subjectId: viewerUserId,
            recipientUserId: viewerUserId,
            recipientLabel: readiness.user.displayName ?? githubAccount,
          },
          { requiresConfirmation: true },
        )
      : !payoutReady
        ? workbenchAction(
            {
              id: "profile.set_payout_destination",
              label: "Choose payout wallet",
              href: returnTo,
            },
            { panel: "payout_destination", subjectId: viewerUserId },
          )
        : discoverNavigationAction(
            {
              id: "discover.open_repository",
              label: "View GitHub profile",
              href: profilePath,
            },
            { target: "external" },
          ),
    secondaryActions: directSupportReady
      ? [
          discoverNavigationAction(
            {
              id: "discover.open_repository",
              label: "View GitHub profile",
              href: profilePath,
            },
            { target: "external", secondary: true },
          ),
        ]
      : [],
    profilePath,
  };
}

export function mergeAttributedDiscoverPeople(
  claimedPeople: DiscoverPerson[],
  opportunities: MarketplaceOpportunity[],
): DiscoverPerson[] {
  const claimedHandles = new Set(
    claimedPeople.flatMap((person) => {
      const match = person.profilePath?.match(
        /^https:\/\/github\.com\/([^/?#]+)/i,
      );
      return match?.[1] ? [decodeURIComponent(match[1]).toLowerCase()] : [];
    }),
  );
  const attributed = new Map<
    string,
    {
      name: string;
      count: number;
      repositories: Set<string>;
      categories: Set<string>;
      evidenceHref?: string;
    }
  >();
  for (const item of opportunities) {
    if (item.source.type !== "github_evidence") continue;
    const name = item.creator.name.trim();
    const handle = name.toLowerCase();
    if (!handle) continue;
    const current = attributed.get(handle) ?? {
      name,
      count: 0,
      repositories: new Set<string>(),
      categories: new Set<string>(),
      evidenceHref: item.sourceUrl,
    };
    current.count += 1;
    if (item.repository) current.repositories.add(item.repository);
    if (item.category)
      current.categories.add(item.category.replaceAll("_", " "));
    current.evidenceHref ??= item.sourceUrl;
    attributed.set(handle, current);
  }
  const enrichedClaimedPeople = claimedPeople.map((person) => {
    const match = person.profilePath?.match(
      /^https:\/\/github\.com\/([^/?#]+)/i,
    );
    const handle = match?.[1]
      ? decodeURIComponent(match[1]).replace(/^@/, "").toLowerCase()
      : null;
    const work = handle ? attributed.get(handle) : undefined;
    if (!work) return person;
    return {
      ...person,
      completedWork: Math.max(person.completedWork ?? 0, work.count),
      skills: [...new Set([...person.skills, ...work.categories])],
      verifiedIdentities: [
        ...person.verifiedIdentities,
        ...(!person.verifiedIdentities.includes("Work attribution verified")
          ? ["Work attribution verified"]
          : []),
      ],
      identityState: "work_attribution_verified" as const,
    } satisfies DiscoverPerson;
  });
  const attributedPeople = [...attributed.entries()]
    .filter(([handle]) => !claimedHandles.has(handle))
    .map(
      ([handle, item]) =>
        ({
          id: `github-actor:${handle}`,
          name: item.name,
          kind: handle.endsWith("[bot]")
            ? ("agent" as const)
            : ("human" as const),
          description: `${item.count} supported accepted event${item.count === 1 ? "" : "s"} attributed across ${item.repositories.size} repositor${item.repositories.size === 1 ? "y" : "ies"}.`,
          verifiedIdentities: ["Work attribution verified"],
          skills: [...item.categories],
          communities: [],
          completedWork: item.count,
          acceptsDirectFunding: false,
          acceptsInvitations: true,
          identityState: "unclaimed_contributor" as const,
          payoutReadiness: "invite_to_claim" as const,
          blocker: `Accepted work is attributed to GitHub @${item.name}, but no claimed RESOLVE profile and verified payout destination are linked.`,
          primaryAction: discoverNavigationAction(
            {
              id: "discover.open_repository",
              label: "View GitHub profile",
              href: `https://github.com/${encodeURIComponent(item.name)}`,
            },
            { target: "external" },
          ),
          secondaryActions: item.evidenceHref
            ? [
                workbenchAction(
                  {
                    id: "discover.open_evidence",
                    label: "Inspect attributed evidence",
                    href: "/discover?view=verified_work",
                  },
                  {
                    panel: "evidence",
                    subjectId: `github-actor:${handle}`,
                    sourceUrl: item.evidenceHref,
                    evidenceIds: [],
                  },
                ),
              ]
            : [],
          profilePath: `https://github.com/${encodeURIComponent(item.name)}`,
        }) satisfies DiscoverPerson,
    );
  return [...enrichedClaimedPeople, ...attributedPeople];
}

export function attachVerifiedWorkActions(
  opportunities: MarketplaceOpportunity[],
  people: DiscoverPerson[],
  viewerUserId?: string,
  liveSettlementEnabled = isLiveArcEnabled(),
): MarketplaceOpportunity[] {
  const personByGithub = new Map(
    people.flatMap((person) => {
      const match = person.profilePath?.match(
        /^https:\/\/github\.com\/([^/?#]+)/i,
      );
      return match?.[1]
        ? [
            [
              decodeURIComponent(match[1]).replace(/^@/, "").toLowerCase(),
              person,
            ] as const,
          ]
        : [];
    }),
  );
  const live = liveSettlementEnabled;

  return opportunities.map((item) => {
    if (
      !isVerifiedWork(item) ||
      item.source.type !== "github_evidence" ||
      !item.sourceUrl ||
      !item.repository
    ) {
      return item;
    }
    const person = personByGithub.get(
      item.creator.name.trim().replace(/^@/, "").toLowerCase(),
    );
    const persistedEvidenceIds =
      item.primaryAction?.presentation?.kind === "workbench" &&
      item.primaryAction.presentation.target.panel === "evidence"
        ? item.primaryAction.presentation.target.evidenceIds
        : [];
    const isSelf = Boolean(person && person.id === viewerUserId);
    const rewardRecipientReady = Boolean(
      person && !isSelf && person.payoutReadiness === "ready",
    );
    const canFund = rewardRecipientReady && live;
    const detailPath = `/discover?view=verified_work&work=${encodeURIComponent(item.source.id)}`;
    const evidenceAction = workbenchAction(
      {
        id: "discover.open_evidence",
        label: "Inspect evidence",
        href: detailPath,
      },
      {
        panel: "evidence",
        subjectId: item.source.id,
        sourceUrl: item.sourceUrl,
        repository: item.repository,
        evidenceIds: persistedEvidenceIds,
      },
    );
    let blocker: string | undefined;
    if (!person)
      blocker =
        "The GitHub attribution is preserved, but this contributor has not claimed a RESOLVE profile.";
    else if (isSelf && person && person.payoutReadiness !== "ready")
      blocker = "Choose a verified payout destination so future rewards can reach you.";
    else if (isSelf)
      blocker = "You cannot reward work attributed to your own payout destination.";
    else if (person.payoutReadiness !== "ready")
      blocker =
        "This contributor has not verified where work rewards should settle.";
    else if (!live)
      blocker =
        "Arc settlement is currently unavailable, so RESOLVE is keeping this evidence inspectable without offering a payment.";

    return {
      ...item,
      creator: { ...item.creator, id: person?.id },
      description:
        "Accepted GitHub activity with a persisted source record. A voluntary reward can be sent only after attribution and payout checks pass.",
      entityState: {
        ...item.entityState!,
        financialReadiness: canFund ? "ready" : "setup_required",
        blocker,
      },
      primaryAction:
        isSelf && person && person.payoutReadiness !== "ready"
          ? workbenchAction(
              {
                id: "profile.set_payout_destination",
                label: "Choose payout wallet",
                href: detailPath,
              },
              { panel: "payout_destination", subjectId: person.id },
            )
          : rewardRecipientReady && person
          ? workbenchAction(
              {
                id: "discover.fund_verified_work",
                // "Reward" implied RESOLVE had judged this work deserving of
                // money. It has not: no funding intent is attached here, and
                // a merge is provenance rather than value. This payment is
                // the viewer's own voluntary decision to support verified
                // work, so the label states whose intent it is. Mechanisms
                // where capital has actually declared a mandate (Pool,
                // sponsor Program, funded Request) are resolved separately
                // by src/lib/discover/impact/economic-matching.ts.
                label: "Support this work",
                href: detailPath,
                enabled: canFund,
                disabledReason: canFund ? undefined : blocker,
              },
              {
                panel: "work_funding",
                subjectId: item.source.id,
                recipientUserId: person.id,
                recipientLabel: person.name,
                workTitle: item.title,
                repository: item.repository,
                sourceUrl: item.sourceUrl,
                evidenceIds: persistedEvidenceIds,
              },
              { requiresConfirmation: true },
            )
          : evidenceAction,
      secondaryActions: rewardRecipientReady ? [evidenceAction] : [],
    } satisfies MarketplaceOpportunity;
  });
}

export function attachRequestActions(
  opportunities: MarketplaceOpportunity[],
  viewerUserId?: string,
): MarketplaceOpportunity[] {
  return opportunities.map((item) => {
    if (item.source.type !== "resolve_request") return item;
    const owner = Boolean(viewerUserId && item.creator.id === viewerUserId);
    const selected = Boolean(
      viewerUserId && item.provider.selected?.id === viewerUserId,
    );
    const href = `/discover?view=requests&request=${encodeURIComponent(item.id)}`;
    let id: ResolveActionId = "discover.view_request";
    let label = "View request";
    if (owner && item.status === "ready_to_fund") {
      id = "discover.post_request";
      label = "Fund and publish";
    } else if (owner && item.status === "under_review") {
      id = "discover.review_request";
      label = "Review submitted work";
    } else if (owner && item.status === "approved") {
      id = "discover.release_request";
      label = "Release payment";
    } else if (selected && item.status === "assigned") {
      id = "discover.submit_request_work";
      label = "Submit evidence";
    } else if (item.status === "open" && !owner) {
      id = "discover.take_request";
      label = "Take request";
    } else if (["assigned", "under_review", "approved", "payment_submitted"].includes(item.status)) {
      id = "discover.track_request";
      label = "Track request";
    } else if (item.status === "confirmed" && (owner || selected)) {
      id = "discover.view_request";
      label = "View receipt";
    }
    return {
      ...item,
      primaryAction: workbenchAction(
        { id, label, href },
        { panel: "request", subjectId: item.id, mode: "view" },
        { requiresConfirmation: ["discover.post_request", "discover.release_request", "discover.take_request"].includes(id) },
      ),
      secondaryActions: [],
    };
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
    const catalog = COMMUNITY_CATALOG.find(
      (item) => item.slug === install.communitySlug,
    );
    const relevantSources = sources.filter(
      (source) =>
        !source.communitySlug || source.communitySlug === install.communitySlug,
    );
    const githubSource =
      relevantSources.find((source) => source.provider === "github_app") ??
      relevantSources.find((source) => source.provider === "github");
    const repositories = [
      ...new Set([
        ...relevantSources.flatMap((source) =>
          repositoryNames(source.capabilitiesJson),
        ),
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
    const poolPrograms = activePrograms.filter((program) => {
      let metadata: Record<string, unknown> = {};
      try {
        metadata = program.metadataJson
          ? (JSON.parse(program.metadataJson) as Record<string, unknown>)
          : {};
      } catch {
        metadata = {};
      }
      return programMarketplaceKind(program.templateId, metadata) === "pool";
    });
    const sourceConnected =
      githubSource &&
      ["connected", "healthy", "syncing", "stale"].includes(
        githubSource.status,
      );
    const sourceState = githubSource?.status ?? "not_configured";
    const targetProgram =
      githubPrograms[0] ?? activePrograms[0] ?? install.programs[0];
    let targetMetadata: Record<string, unknown> = {};
    try {
      targetMetadata = targetProgram?.metadataJson
        ? (JSON.parse(targetProgram.metadataJson) as Record<string, unknown>)
        : {};
    } catch {
      targetMetadata = {};
    }
    const publicationApproved = targetMetadata.publicationStatus === "approved";
    const policyActive = targetMetadata.policyStatus === "active";
    const treasuryAddress =
      typeof targetMetadata.treasuryAddress === "string"
        ? targetMetadata.treasuryAddress
        : "";
    const treasuryReady = /^0x[a-fA-F0-9]{40}$/.test(treasuryAddress);
    const blocker = !sourceConnected
      ? "Connect or repair GitHub repository access."
      : activePrograms.length === 0
        ? "Create a program for accepted activity."
        : githubPrograms.length === 0
          ? "No active program uses the supported GitHub adapter."
          : !publicationApproved
            ? "Approve this Program for public discovery."
            : !policyActive
              ? "Activate a versioned funding policy."
              : !treasuryReady
                ? "Add a valid Arc treasury destination."
                : undefined;
    const step = !targetProgram
      ? "create_program"
      : githubPrograms.length === 0
        ? "source"
        : !publicationApproved
          ? "publication"
          : !policyActive
            ? "policy"
            : !treasuryReady
              ? "treasury"
              : "review";
    const actionLabel = !targetProgram
      ? "Create program"
      : step === "source"
        ? "Configure GitHub evidence"
        : step === "publication"
          ? "Review publication"
          : step === "policy"
            ? "Design policy"
            : step === "treasury"
              ? "Add treasury destination"
              : "Review operating program";
    const returnTo = "/discover?view=activity";
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
      poolCount: poolPrograms.length,
      programId: targetProgram?.id,
      blocker,
      primaryAction: sourceConnected
        ? workbenchAction(
            {
              id: targetProgram
                ? "program.update_policy"
                : "program.create_draft",
              label: actionLabel,
              href: returnTo,
            },
            {
              panel: "program_setup",
              subjectId: install.id,
              programId: targetProgram?.id,
              communitySlug: install.communitySlug,
              step: step === "create_program" ? "create" : step,
            },
          )
        : workbenchAction(
            {
              id: "source.reconnect",
              label: "Repair GitHub access",
              href: returnTo,
            },
            {
              panel: "source_sync",
              subjectId: install.id,
              provider: "github",
            },
          ),
      secondaryActions: [],
    } satisfies DiscoverMyCommunity;
  });
}

function loadCachedMyDiscoverCommunities(userId: string) {
  return cacheGetOrSetResilient(
    `discover:my-communities:v2:${userId}`,
    30,
    () =>
      withTimeout(
        listMyDiscoverCommunities(userId),
        PERSONAL_ENRICHMENT_TIMEOUT_MS,
      ),
    { staleSeconds: 86_400 },
  );
}

export function myDiscoverCommunitiesFromReadiness(
  readiness: WorkspaceReadiness,
): DiscoverMyCommunity[] {
  const repositoryAccounts = readiness.sources
    .filter(
      (source) =>
        source.provider === "github" || source.provider === "github_app",
    )
    .flatMap((source) =>
      source.account && source.account.includes("/")
        ? [source.account.replace(/^@/, "")]
        : [],
    );
  const repositoryAccessReady = ["connected", "stale", "syncing"].includes(
    readiness.github.repositoryAccess.state,
  );
  return readiness.communities.map((community) => {
    const catalog = COMMUNITY_CATALOG.find(
      (item) => item.slug === community.slug,
    );
    const programs = readiness.programs.filter(
      (program) => program.communitySlug === community.slug,
    );
    const activePrograms = programs.filter((program) =>
      ["active", "deployed"].includes(program.status),
    );
    const step = !repositoryAccessReady
      ? "source"
      : programs.length
        ? "review"
        : "create_program";
    const blocker = !repositoryAccessReady
      ? "Connect or repair GitHub repository access."
      : programs.length === 0
        ? "Create a program for accepted activity."
        : "Review publication, policy, and treasury readiness in the operator console.";
    const returnTo = "/discover?view=activity";
    return {
      id: community.id,
      slug: community.slug,
      name: catalog?.name ?? community.slug,
      role:
        community.role === "owner" || community.role === "operator"
          ? community.role
          : "member",
      status: community.status,
      sourceState: readiness.github.repositoryAccess.state,
      repositories: [...new Set(repositoryAccounts)],
      programCount: programs.length,
      activeProgramCount: activePrograms.length,
      poolCount: 0,
      programId: programs[0]?.id,
      blocker,
      primaryAction: repositoryAccessReady
        ? workbenchAction(
            {
              id: programs[0]
                ? "program.update_policy"
                : "program.create_draft",
              label: programs.length
                ? "Review operating program"
                : "Create program",
              href: returnTo,
            },
            {
              panel: "program_setup",
              subjectId: community.id,
              programId: programs[0]?.id,
              communitySlug: community.slug,
              step: programs.length ? "review" : "create",
            },
          )
        : workbenchAction(
            {
              id: "source.reconnect",
              label: "Repair GitHub access",
              href: returnTo,
            },
            {
              panel: "source_sync",
              subjectId: community.id,
              provider: "github",
            },
          ),
      secondaryActions: [],
    };
  });
}

function listCommunities(
  opportunities: MarketplaceOpportunity[],
): DiscoverCommunity[] {
  return COMMUNITY_CATALOG.flatMap((community) => {
    const matching = opportunities.filter(
      (item) => item.community?.id === community.slug,
    );
    if (!matching.length) return [];
    const pools = new Set(
      matching.map((item) => item.pool?.id).filter(Boolean),
    );
    const publicFunding = matching.reduce(
      (total, item) => total + (item.funding?.fundedAmountUsd ?? 0),
      0,
    );
    return [
      {
        id: community.slug,
        slug: community.slug,
        name: community.name,
        purpose: community.tagline,
        type: community.kind,
        activeOpportunities: matching.length || undefined,
        activePools: pools.size || undefined,
        publicFundingUsd: publicFunding > 0 ? publicFunding : undefined,
        verified: true,
      },
    ];
  });
}

function poolType(item: MarketplaceOpportunity) {
  const text =
    `${item.title} ${item.summary} ${item.category ?? ""}`.toLowerCase();
  if (text.includes("quadratic")) return "Quadratic Funding Pool";
  if (text.includes("security") || text.includes("emergency"))
    return "Emergency or Security Response Pool";
  if (text.includes("matching")) return "Matching Pool";
  if (text.includes("grant")) return "Community Grants Pool";
  if (text.includes("creator")) return "Creator Support Pool";
  if (text.includes("retroactive") || text.includes("public good"))
    return "Retroactive Funding Pool";
  if (text.includes("recurring")) return "Recurring Program Pool";
  if (text.includes("ecosystem") || text.includes("incentive"))
    return "Ecosystem Incentive Pool";
  if (text.includes("contributor") || text.includes("open source"))
    return "Contributor Rewards Pool";
  return "General Community Pool";
}

/**
 * Names the exact remaining step so an operator card never says only
 * "Review program". Each label is the work itself, not an invitation to go
 * look at something.
 */
const POOL_SETUP_LABEL: Record<
  NonNullable<DiscoverEntityState["setupStep"]>,
  string
> = {
  create: "Create funding rule",
  source: "Connect evidence source",
  publication: "Publish Pool",
  policy: "Define funding rule",
  treasury: "Add treasury",
  review: "Review distribution",
};

export function listPools(
  opportunities: MarketplaceOpportunity[],
  viewerUserId?: string,
): DiscoverPool[] {
  return opportunities.flatMap((item) => {
    if (item.marketplaceKind !== "pool" || !item.pool || !item.community)
      return [];
    const confirmed = item.funding?.amountState === "confirmed";
    const balance = confirmed ? (item.funding?.fundedAmountUsd ?? 0) : 0;
    const target = item.funding?.goalAmountUsd;
    const pendingDeposits = item.funding?.pendingAmountUsd;
    const financiallyReady = item.entityState?.financialReadiness === "ready";
    const executionReady = financiallyReady && isLiveArcEnabled();
    const operatorOwnsPool = Boolean(
      viewerUserId && item.creator.id === viewerUserId,
    );
    const publicationState =
      item.entityState?.lifecycle === "published"
        ? "approved"
        : "legacy_active";
    return [
      {
        id: item.pool.id ?? item.source.id,
        name: item.pool.name,
        owner: item.creator.name,
        communitySlug: item.community.id ?? item.community.name,
        purpose: item.summary,
        type: poolType(item),
        balanceUsd: balance,
        committedUsd: confirmed ? balance : undefined,
        availableUsd: confirmed ? balance : 0,
        token: item.reward?.token,
        network: item.reward?.network,
        eligibleOpportunityTypes: [item.type],
        applicationModel:
          item.provider.preference === "invite_only"
            ? "Invite only"
            : "Open applications",
        verificationMechanism:
          item.evidenceRequirements.length > 0
            ? item.evidenceRequirements[0]
            : undefined,
        balanceState: item.funding?.amountState,
        targetUsd: target,
        pendingDepositsUsd: pendingDeposits,
        // Progress is measured against the next checkpoint, computed from the
        // capital RESOLVE can actually prove moved on chain.
        ...(() => {
          const segment = computePoolMilestoneSegment(balance);
          return balance > 0 || segment.ceilingUsd > 0
            ? {
                nextCheckpointUsd: segment.ceilingUsd,
                checkpointProgressPct: segment.progressPct,
              }
            : {};
        })(),
        lifecycleState: executionReady
          ? "accepting_funding"
          : financiallyReady
            ? "published"
            : "setup_incomplete",
        publicationState,
        policyState: financiallyReady ? "active" : "setup_required",
        treasuryReadiness: financiallyReady ? "ready" : "setup_required",
        setupStep: item.entityState?.setupStep,
        blocker:
          financiallyReady && !executionReady
            ? "Live Arc settlement is not enabled for this Pool."
            : item.entityState?.blocker,
        primaryAction: executionReady
          ? workbenchAction(
              {
                id: "capital.open_funding",
                label: "Fund Pool",
                href: `/discover?view=pools&pool=${encodeURIComponent(item.pool.id ?? item.source.id)}`,
              },
              {
                panel: "pool_funding",
                subjectId: item.pool.id ?? item.source.id,
                programId: item.pool.id ?? item.source.id,
                communitySlug: item.community.id ?? item.community.name,
                poolName: item.pool.name,
                poolType: poolType(item),
                purpose: item.summary,
                balanceUsd: balance,
                targetUsd: target,
                activeRule: item.evidenceRequirements[0],
              },
              { requiresConfirmation: true },
            )
          : financiallyReady
            ? workbenchAction(
                {
                  id: "capital.open_funding",
                  label: "Fund Pool unavailable",
                  href: `/discover?view=pools&pool=${encodeURIComponent(item.pool.id ?? item.source.id)}`,
                  enabled: false,
                  disabledReason:
                    "Live Arc settlement is not enabled for this Pool.",
                },
                {
                  panel: "pool_funding",
                  subjectId: item.pool.id ?? item.source.id,
                  programId: item.pool.id ?? item.source.id,
                  communitySlug: item.community.id ?? item.community.name,
                  poolName: item.pool.name,
                  poolType: poolType(item),
                  purpose: item.summary,
                  balanceUsd: balance,
                  targetUsd: target,
                  activeRule: item.evidenceRequirements[0],
                },
              )
            : operatorOwnsPool
              ? workbenchAction(
                  {
                    id: "program.update_policy",
                    // Branch on the canonical setup step, never on blocker
                    // prose. The blocker reads "Approve this Program for
                    // public discovery", which matches none of the old
                    // substrings, so every unconfigured Pool fell through to
                    // a generic "Review program" that named no real work.
                    label: POOL_SETUP_LABEL[item.entityState?.setupStep ?? "review"],
                    href: `/discover?view=pools&pool=${encodeURIComponent(item.pool.id ?? item.source.id)}`,
                  },
                  {
                    panel: "program_setup",
                    subjectId: item.pool.id ?? item.source.id,
                    programId: item.pool.id ?? item.source.id,
                    communitySlug: item.community.id ?? item.community.name,
                    step: item.entityState?.setupStep ?? "review",
                  },
                )
              : workbenchAction(
                  {
                    id: "discover.open_pools",
                    label: "View Pool",
                    href: `/discover?view=pools&pool=${encodeURIComponent(item.pool.id ?? item.source.id)}`,
                  },
                  {
                    panel: "entity_details",
                    subjectId: item.pool.id ?? item.source.id,
                    entityType: "pool",
                  },
                ),
        secondaryActions: [
          ...(item.secondaryActions ?? []).filter(
            (action) =>
              action.presentation?.kind !== "navigation" ||
              action.presentation.target !== "workspace",
          ),
          ...(operatorOwnsPool && financiallyReady
            ? [
                workbenchAction(
                  {
                    id: "capital.authorize_settlement",
                    label: "Review distribution",
                    href: `/discover?view=pools&pool=${encodeURIComponent(item.pool.id ?? item.source.id)}`,
                  },
                  {
                    panel: "pool_distribution",
                    subjectId: item.pool.id ?? item.source.id,
                    programId: item.pool.id ?? item.source.id,
                    communitySlug: item.community.id ?? item.community.name,
                    poolName: item.pool.name,
                  },
                ),
              ]
            : []),
        ],
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
      blocker:
        readiness.github.repositorySync.errorCode ??
        "Repository synchronization failed.",
      occurredAt: readiness.github.repositorySync.lastSuccessfulAt ?? undefined,
      primaryAction: workbenchAction(
        {
          id: "source.reconnect",
          label: "Repair GitHub access",
          href: "/discover?view=activity",
        },
        {
          panel: "source_sync",
          subjectId: "github",
          provider: "github",
        },
      ),
      secondaryActions: [],
    });
  }

  if (
    readiness &&
    ["connected", "syncing", "stale"].includes(
      readiness.github.repositoryAccess.state,
    ) &&
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
      primaryAction: workbenchAction(
        {
          id: "source.sync",
          label: "Review repository sync",
          href: "/discover?view=verified_work",
        },
        {
          panel: "source_sync",
          subjectId: "github-snapshot",
          provider: "github",
        },
      ),
      secondaryActions: [
        discoverNavigationAction(
          {
            id: "discover.open_verified_work",
            label: "Open Verified Work",
            href: "/discover?view=verified_work",
          },
          { secondary: true },
        ),
      ],
    });
  }

  const self = readiness
    ? people.find((person) => person.id === readiness.userId)
    : undefined;
  if (self && self.payoutReadiness !== "ready") {
    const eligibleWallets = [
      readiness?.wallets.app.address,
      readiness?.wallets.connected.address,
    ].filter((address): address is string => Boolean(address));
    items.push({
      id: "contributor:complete-payout",
      audience: "contributor",
      title: "Choose your payout destination",
      why:
        eligibleWallets.length > 1
          ? "Two eligible wallets are available. Select where future RESOLVE earnings should settle."
          : "Select an eligible wallet for future RESOLVE earnings.",
      state: self.payoutReadiness,
      blocker: self.blocker,
      primaryAction: self.primaryAction,
      secondaryActions: [
        discoverNavigationAction(
          {
            id: "discover.open_verified_work",
            label: "View recognised work",
            href: "/discover?view=verified_work",
          },
          { secondary: true },
        ),
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
      primaryAction: workbenchAction(
        {
          id: "capital.review_authorization",
          label: "Review authorization",
          href: "/discover?view=verified_work",
        },
        {
          panel: "authorization_review",
          subjectId: "pending-authorizations",
        },
        { requiresConfirmation: true },
      ),
      secondaryActions: [],
    });
  }

  const readyPool = pools.find(
    (pool) => pool.lifecycleState === "accepting_funding",
  );
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

  const priority = (item: DiscoverInboxItem) => {
    if (item.id === "contributor:complete-payout") return 0;
    if (item.id === "funder:pending-authorizations") return 1;
    if (
      item.id.startsWith("funder:pool:") ||
      item.id.startsWith("funder:person:")
    )
      return 2;
    if (item.id === "operator:repair-github-sync") return 3;
    if (item.id.startsWith("operator:pool-setup:")) return 4;
    return 5;
  };
  return items.sort((a, b) => priority(a) - priority(b)).slice(0, 8);
}

function friendlyActivityLabel(eventType: string) {
  const labels: Record<string, string> = {
    "capital.wallet_selected": "Payout wallet selected",
    "profile.payout_destination_selected": "Payout destination updated",
    "discover.repository_snapshot_captured": "Repository evidence refreshed",
    "discover.mission_started": "Analysis started",
    "discover.direct_support_confirmed": "Direct support confirmed",
    "discover.direct_support_received": "Direct support received",
    "discover.work_reward_confirmed": "Verified work funded",
    "discover.work_reward_received": "Verified work reward received",
    "program.draft_created": "Program draft created",
    "program.policy_updated": "Program policy updated",
    "source.sync_completed": "Source refresh completed",
  };
  return (
    labels[eventType] ?? eventType.replaceAll(".", " ").replaceAll("_", " ")
  );
}

/**
 * Explicit allowlist, not fuzzy substring matching. A loose
 * `.includes("repository")` here previously classified
 * "discover.repository_snapshot_captured" (a pure internal source-refresh
 * event, not a customer economic action) as kind "work", which leaked it
 * into the primary Activity economic feed alongside real work rewards.
 * Anything not explicitly recognized here falls back to "account" and is
 * excluded from the primary ledger — the safe default for an unrecognized
 * event is "not economic content," not "guess and show it."
 */
const ACTIVITY_EVENT_KIND: Record<string, DiscoverActivityItem["kind"]> = {
  "discover.direct_support_confirmed": "receipt",
  "discover.direct_support_received": "receipt",
  "discover.work_reward_confirmed": "receipt",
  "discover.work_reward_received": "receipt",
  "settlement.batch_reconciled": "receipt",
  "settlement.package_prepared": "funding",
  "request_payment_confirmed": "receipt",
  "request_funded": "funding",
  "request_created": "funding",
  "request_assigned": "work",
  "request_work_submitted": "work",
  "request_work_approved": "work",
  "pool_funding_pending": "pool",
  "fund_program": "pool",
  "program_rebalanced": "pool",
  "qf.match": "pool",
  "qf.contribution": "funding",
  "application_submitted": "work",
};

export function activityKindForEvent(eventType: string): DiscoverActivityItem["kind"] {
  const explicit = ACTIVITY_EVENT_KIND[eventType];
  if (explicit) return explicit;
  if (eventType.startsWith("program.")) return "program";
  return "account";
}

function eventDescription(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return fallback;
  const record = payload as Record<string, unknown>;
  for (const key of [
    "title",
    "label",
    "repository",
    "provider",
    "communitySlug",
  ]) {
    const value = record[key];
    if (typeof value === "string" && value.trim())
      return value.trim().slice(0, 180);
  }
  return fallback;
}

function discoverPaymentPackage(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (row.kind !== "direct_support" && row.kind !== "work_reward") return null;
  const work =
    row.work && typeof row.work === "object" && !Array.isArray(row.work)
      ? (row.work as Record<string, unknown>)
      : null;
  return {
    kind: row.kind,
    recipientLabel:
      typeof row.recipientLabel === "string"
        ? row.recipientLabel
        : "Verified recipient",
    workTitle: typeof work?.title === "string" ? work.title : undefined,
    repository:
      typeof work?.repository === "string" ? work.repository : undefined,
  };
}

async function loadPersonalDiscoverActivity(
  userId: string,
  opportunities: MarketplaceOpportunity[],
  people: DiscoverPerson[],
): Promise<DiscoverActivityItem[]> {
  const [intents, events, recipientPayments, agentTransactions] =
    await Promise.all([
    prisma.fundingIntent.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: {
        id: true,
        communitySlug: true,
        programId: true,
        amountUsdcMicro: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.operationalEvent.findMany({
      where: {
        userId,
        OR: [
          { eventType: { startsWith: "discover." } },
          { eventType: { startsWith: "capital." } },
          { eventType: { startsWith: "settlement." } },
          { eventType: { startsWith: "program." } },
          { eventType: { startsWith: "profile.payout" } },
          { eventType: { startsWith: "source.sync" } },
          { eventType: "pool_funding_pending" },
          { eventType: "application_submitted" },
        ],
      },
      orderBy: { occurredAt: "desc" },
      take: 40,
      select: {
        id: true,
        eventType: true,
        aggregateId: true,
        communitySlug: true,
        payload: true,
        occurredAt: true,
      },
    }),
    prisma.settlementBatch.findMany({
      where: {
        userId,
        fundingIntentId: null,
        status: { in: ["submitted", "confirmed"] },
      },
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: {
        id: true,
        status: true,
        totalUsdcMicro: true,
        preparedPackage: true,
        submittedAt: true,
        confirmedAt: true,
        updatedAt: true,
      },
    }),
    prisma.walletTransaction.findMany({
      where: { userId, type: "agent_signal" },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        method: true,
        amountUsd: true,
        status: true,
        label: true,
        createdAt: true,
      },
    }),
  ]);
  const intentIds = intents.map((intent) => intent.id);
  const transactions = intentIds.length
    ? await prisma.chainTransaction.findMany({
        where: { fundingIntentId: { in: intentIds } },
        orderBy: { submittedAt: "desc" },
        select: {
          id: true,
          fundingIntentId: true,
          txHash: true,
          status: true,
          chainId: true,
          submittedAt: true,
          confirmedAt: true,
        },
      })
    : [];
  const transactionIds = transactions.map((transaction) => transaction.id);
  const receipts = transactionIds.length
    ? await prisma.receipt.findMany({
        where: { chainTransactionId: { in: transactionIds } },
        select: {
          id: true,
          chainTransactionId: true,
          publicReference: true,
          totalUsdcMicro: true,
          issuedAt: true,
        },
      })
    : [];
  const transactionByIntent = new Map<string, (typeof transactions)[number]>();
  for (const transaction of transactions) {
    if (
      transaction.fundingIntentId &&
      !transactionByIntent.has(transaction.fundingIntentId)
    ) {
      transactionByIntent.set(transaction.fundingIntentId, transaction);
    }
  }
  const receiptByTransaction = new Map(
    receipts.map((receipt) => [receipt.chainTransactionId, receipt]),
  );

  const recipientPaymentIds = recipientPayments.map((batch) => batch.id);
  const recipientTransactions = recipientPaymentIds.length
    ? await prisma.chainTransaction.findMany({
        where: { settlementBatchId: { in: recipientPaymentIds } },
        orderBy: { submittedAt: "desc" },
        select: {
          id: true,
          settlementBatchId: true,
          txHash: true,
          status: true,
          submittedAt: true,
          confirmedAt: true,
        },
      })
    : [];
  const recipientReceipts = recipientPaymentIds.length
    ? await prisma.receipt.findMany({
        where: { settlementBatchId: { in: recipientPaymentIds } },
        select: {
          id: true,
          settlementBatchId: true,
          publicReference: true,
          issuedAt: true,
        },
      })
    : [];
  const recipientTransactionByBatch = new Map(
    recipientTransactions.flatMap((transaction) =>
      transaction.settlementBatchId
        ? [[transaction.settlementBatchId, transaction] as const]
        : [],
    ),
  );
  const recipientReceiptByBatch = new Map(
    recipientReceipts.map((receipt) => [receipt.settlementBatchId, receipt]),
  );

  const fundingRows: DiscoverActivityItem[] = intents.map((intent) => {
    const transaction = transactionByIntent.get(intent.id);
    const receipt = transaction
      ? receiptByTransaction.get(transaction.id)
      : undefined;
    const state = receipt
      ? "confirmed"
      : (transaction?.status ?? intent.status);
    const amountUsd = Number(intent.amountUsdcMicro) / 1_000_000;
    const primaryAction = receipt
      ? workbenchAction(
          {
            id: "receipt.open",
            label: "View receipt",
            href: canonicalOutcomeHref(receipt.publicReference),
          },
          {
            panel: "receipt",
            subjectId: receipt.id,
            receiptUrl: canonicalOutcomeHref(receipt.publicReference),
          },
        )
      : workbenchAction(
          {
            id: "capital.open_transaction",
            label: "Track transaction",
            href: `/discover?view=activity&action=capital.open_transaction&subject=${encodeURIComponent(intent.id)}`,
          },
          {
            panel: "transaction",
            subjectId: intent.id,
            fundingIntentId: intent.id,
          },
        );
    return {
      id: `funding:${intent.id}`,
      kind: receipt ? "receipt" : "transaction",
      title: receipt ? "Funding confirmed" : "Funding activity",
      description: intent.communitySlug
        ? `${intent.communitySlug}${intent.programId ? ` / ${intent.programId}` : ""}`
        : "Direct support or funding authorization",
      state,
      occurredAt:
        receipt?.issuedAt.toISOString() ??
        transaction?.confirmedAt?.toISOString() ??
        transaction?.submittedAt.toISOString() ??
        intent.updatedAt.toISOString(),
      amountUsd,
      token: "USDC",
      community: intent.communitySlug ?? undefined,
      primaryAction,
    };
  });

  const recipientPaymentRows: DiscoverActivityItem[] =
    recipientPayments.flatMap((batch) => {
      const payment = discoverPaymentPackage(batch.preparedPackage);
      if (!payment) return [];
      const transaction = recipientTransactionByBatch.get(batch.id);
      const receipt = recipientReceiptByBatch.get(batch.id);
      const amountUsd = Number(batch.totalUsdcMicro) / 1_000_000;
      const title =
        payment.kind === "work_reward"
          ? `Funded ${payment.workTitle ?? "verified work"}`
          : `Supported ${payment.recipientLabel}`;
      const description =
        payment.kind === "work_reward"
          ? `${payment.repository ?? "Persisted GitHub evidence"} / ${payment.recipientLabel}`
          : `Direct support to ${payment.recipientLabel}`;
      const primaryAction = receipt
        ? workbenchAction(
            {
              id: "receipt.open",
              label: "View receipt",
              href: canonicalOutcomeHref(receipt.publicReference),
            },
            {
              panel: "receipt",
              subjectId: receipt.id,
              receiptUrl: canonicalOutcomeHref(receipt.publicReference),
              explorerUrl: transaction?.txHash
                ? explorerTxUrl(transaction.txHash)
                : undefined,
            },
          )
        : undefined;
      return [
        {
          id: `recipient-payment:${batch.id}`,
          kind: receipt ? "receipt" : "transaction",
          title,
          description,
          state: receipt ? "confirmed" : (transaction?.status ?? batch.status),
          occurredAt:
            receipt?.issuedAt.toISOString() ??
            transaction?.confirmedAt?.toISOString() ??
            transaction?.submittedAt.toISOString() ??
            batch.confirmedAt?.toISOString() ??
            batch.submittedAt?.toISOString() ??
            batch.updatedAt.toISOString(),
          amountUsd,
          token: "USDC",
          repository: payment.repository,
          primaryAction,
        } satisfies DiscoverActivityItem,
      ];
    });

  const self = people.find((person) => person.id === userId);
  const githubHandle = self?.profilePath
    ?.match(/^https:\/\/github\.com\/([^/?#]+)/i)?.[1]
    ?.toLowerCase();
  const ownedMarketplace = opportunities.filter(
    (item) =>
      item.creator.id === userId ||
      (githubHandle && item.creator.name.toLowerCase() === githubHandle),
  );
  const marketplaceRows: DiscoverActivityItem[] = ownedMarketplace.map(
    (item) => ({
      id: `owned:${item.id}`,
      kind: isConfirmedOutcome(item)
        ? "receipt"
        : isVerifiedWork(item)
          ? "work"
          : isProgram(item)
            ? "program"
            : item.marketplaceKind === "pool"
              ? "pool"
              : "work",
      title: item.title,
      description: isVerifiedWork(item)
        ? `${item.repository ?? "Verified source"} / ${item.creator.name}`
        : item.summary,
      state: isConfirmedOutcome(item) ? "confirmed" : item.status,
      occurredAt: item.updatedAt,
      amountUsd: isConfirmedOutcome(item)
        ? item.funding?.fundedAmountUsd
        : undefined,
      token: item.reward?.token,
      community: item.community?.name,
      repository: item.repository,
      primaryAction: item.primaryAction,
    }),
  );
  const eventRows: DiscoverActivityItem[] = events
    .filter(
      (event) =>
        event.eventType.startsWith("settlement.") ||
        [
          "discover.direct_support_received",
          "discover.work_reward_received",
          "pool_funding_pending",
          "application_submitted",
        ].includes(event.eventType),
    )
    .map((event) => {
      const payload =
        event.payload &&
        typeof event.payload === "object" &&
        !Array.isArray(event.payload)
          ? (event.payload as Record<string, unknown>)
          : {};
      const publicReference =
        typeof payload.publicReference === "string"
          ? payload.publicReference
          : undefined;
      const amountMicro =
        typeof payload.amountUsdcMicro === "string"
          ? Number(payload.amountUsdcMicro)
          : typeof payload.amountUsdcMicro === "number"
            ? payload.amountUsdcMicro
            : undefined;
      return {
        id: `event:${event.id}`,
        kind: activityKindForEvent(event.eventType),
        title: friendlyActivityLabel(event.eventType),
        description: eventDescription(
          event.payload,
          event.communitySlug ?? event.aggregateId,
        ),
        state: event.eventType.split(".").at(-1) ?? "recorded",
        occurredAt: event.occurredAt.toISOString(),
        amountUsd:
          amountMicro === undefined || !Number.isFinite(amountMicro)
            ? undefined
            : amountMicro / 1_000_000,
        token: amountMicro === undefined ? undefined : "USDC",
        community: event.communitySlug ?? undefined,
        repository:
          typeof payload.repository === "string"
            ? payload.repository
            : undefined,
        primaryAction: publicReference
          ? workbenchAction(
              {
                id: "receipt.open",
                label: "View receipt",
                href: canonicalOutcomeHref(publicReference),
              },
              {
                panel: "receipt",
                subjectId: event.aggregateId,
                receiptUrl: canonicalOutcomeHref(publicReference),
                explorerUrl:
                  typeof payload.txHash === "string"
                    ? explorerTxUrl(payload.txHash)
                    : undefined,
              },
            )
          : undefined,
      };
    });

  const agentRows: DiscoverActivityItem[] = agentTransactions.map(
    (transaction) => {
      const labelParts = transaction.label?.split(":") ?? [];
      const hasKnownPrefix =
        labelParts[0] === "agent" || labelParts[0] === "agent_tx";
      const serviceId = hasKnownPrefix ? labelParts[1] : undefined;
      const taskId = hasKnownPrefix ? labelParts[2] : undefined;
      const txHash = hasKnownPrefix ? labelParts[3] : undefined;
      const service = serviceId ? getAgentSignalService(serviceId) : undefined;
      const primaryAction =
        txHash && /^0x[0-9a-f]{64}$/i.test(txHash)
          ? discoverNavigationAction(
              {
                id: "receipt.open_arcscan",
                label: "Open Arc transaction",
                href: explorerTxUrl(txHash),
              },
              { target: "external" },
            )
          : undefined;
      return {
        id: `agent-service:${transaction.id}`,
        kind: "agent_service",
        title: service?.name
          ? `${service.name} service purchase`
          : "Agent service purchase",
        description: [
          "RESOLVE registered service",
          taskId ? `Task ${taskId}` : null,
          transaction.method === "crypto"
            ? "Connected wallet"
            : "RESOLVE wallet",
          "Arc Testnet",
        ]
          .filter(Boolean)
          .join(" / "),
        state: transaction.status,
        occurredAt: transaction.createdAt.toISOString(),
        amountUsd: Math.abs(transaction.amountUsd),
        token: "USDC",
        primaryAction,
      } satisfies DiscoverActivityItem;
    },
  );

  const seen = new Set<string>();
  return [
    ...fundingRows,
    ...recipientPaymentRows,
    ...agentRows,
    ...marketplaceRows,
    ...eventRows,
  ]
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .filter((item) => {
      const key = `${item.kind}:${item.title.toLowerCase()}:${item.occurredAt.slice(0, 16)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 50);
}

async function loadDiscoverSourceDiagnostics(
  readiness: Awaited<ReturnType<typeof loadWorkspaceReadiness>> | null,
  repositories: string[],
): Promise<DiscoverSourceDiagnostic[]> {
  const stored = await loadCachedStoredOssOpportunities().catch(() => ({
    opportunities: [],
    meta: {
      scannedAt: new Date(0).toISOString(),
      source: "unavailable",
      stale: true,
      staleRepositories: [] as string[],
    },
  }));
  const byName = new Map(
    stored.opportunities.map((item) => [item.fullName.toLowerCase(), item]),
  );
  const names = [
    ...new Set([
      ...repositories,
      ...stored.opportunities.map((item) => item.fullName),
    ]),
  ];
  if (!names.length && readiness) {
    return [
      {
        id: "github:no-repository",
        provider: "github",
        state: readiness.github.repositoryAccess.state,
        evaluationPeriod: "No repository selected",
        eventsInspected: null,
        acceptedEvents: 0,
        lastSuccessfulAt: readiness.github.repositorySync.lastSuccessfulAt,
        reason:
          "GitHub identity is connected, but no persisted repository snapshot is selected for accepted-work evaluation.",
        stale: readiness.stale,
        primaryAction: discoverNavigationAction({
          id: "discover.open_public_repository_analysis",
          label: "Analyze a public repository",
          href: "/discover?view=verified_work&analyze=1#repository-analysis",
        }),
        secondaryActions: [],
      },
    ];
  }
  return names.slice(0, 12).map((name) => {
    const snapshot = byName.get(name.toLowerCase());
    const records = snapshot?.activity?.records ?? [];
    const accepted = snapshot
      ? normalizeGithubAcceptedWork([snapshot]).length
      : 0;
    const rangeStart = snapshot?.activity?.rangeStart;
    const rangeEnd = snapshot?.activity?.rangeEnd;
    const evaluationPeriod =
      rangeStart && rangeEnd
        ? `${new Date(rangeStart).toLocaleDateString("en-US")} to ${new Date(rangeEnd).toLocaleDateString("en-US")}`
        : "Latest persisted repository snapshot";
    const lastSuccessfulAt =
      snapshot?.activity?.observedAt ?? stored.meta.scannedAt;
    return {
      id: `github:${name.toLowerCase()}`,
      provider: "github",
      repository: name,
      state: snapshot
        ? stored.meta.staleRepositories?.includes(name)
          ? "stale"
          : "connected"
        : "snapshot_required",
      evaluationPeriod,
      eventsInspected: snapshot ? records.length : null,
      acceptedEvents: accepted,
      lastSuccessfulAt,
      reason: snapshot
        ? accepted > 0
          ? `${accepted} supported accepted event${accepted === 1 ? "" : "s"} passed the persisted evidence rules.`
          : "No merged pull request, submitted review, merged documentation change, or attributed release passed the supported evidence rules in this snapshot."
        : "Repository access is known, but no successful persisted evidence snapshot exists for this repository.",
      stale:
        !snapshot || Boolean(stored.meta.staleRepositories?.includes(name)),
      primaryAction: discoverNavigationAction({
        id: "discover.open_public_repository_analysis",
        label: snapshot ? "Refresh repository analysis" : "Analyze repository",
        href: `/discover?view=verified_work&analyze=1&repository=${encodeURIComponent(name)}#repository-analysis`,
      }),
      secondaryActions: [
        discoverNavigationAction(
          {
            id: "discover.open_repository",
            label: "Open on GitHub",
            href: `https://github.com/${name}`,
          },
          { target: "external", secondary: true },
        ),
      ],
    } satisfies DiscoverSourceDiagnostic;
  });
}

export async function loadDiscoverPageData(
  filters: OpportunityFilters,
  view: DiscoverPageData["view"],
): Promise<DiscoverPageData> {
  const opportunitiesPromise = listMarketplaceOpportunities(
    filters,
    view === "explore" ? 80 : view === "outcomes" ? 24 : PAGE_SIZE,
    view,
  );
  const userPromise = getSessionUser().catch(() => null);
  const activeFundingPromise = withTimeout(
    loadConfirmedFundingUsd(),
    1_500,
  ).catch(() => undefined);
  const peoplePromise = userPromise.then(async (user) => {
    try {
      return {
        items: await loadCachedDiscoverPeople(user?.id),
        error: null as string | null,
      };
    } catch {
      return {
        items: [] as DiscoverPerson[],
        error: `Claimed contributor profiles did not refresh before the ${PERSONAL_ENRICHMENT_TIMEOUT_LABEL}. Persisted accepted-work attribution remains available.`,
      };
    }
  });
  const readinessPromise = userPromise.then(
    async (
      user,
    ): Promise<{
      value: WorkspaceReadiness | null;
      error: string | null;
    }> => {
      if (!user) return { value: null, error: null };
      try {
        return {
          value: await withTimeout(
            loadWorkspaceReadiness(user.id),
            PERSONAL_SOURCE_TIMEOUT_MS,
          ),
          error: null,
        };
      } catch {
        return {
          value: null,
          error: `Workspace readiness did not refresh before the ${PERSONAL_SOURCE_TIMEOUT_LABEL}.`,
        };
      }
    },
  );
  const myCommunitiesPromise = userPromise.then(async (user) => {
    if (!user)
      return {
        items: [] as DiscoverMyCommunity[],
        error: null as string | null,
      };
    try {
      return {
        items: await loadCachedMyDiscoverCommunities(user.id),
        error: null as string | null,
      };
    } catch {
      return {
        items: [] as DiscoverMyCommunity[],
        error: `Community installations, repositories, programs, and Pools did not refresh before the ${PERSONAL_ENRICHMENT_TIMEOUT_LABEL}.`,
      };
    }
  });
  const [
    opportunities,
    user,
    activeFundingUsd,
    peopleResult,
    readinessResult,
    communitiesResult,
  ] = await Promise.all([
    opportunitiesPromise,
    userPromise,
    activeFundingPromise,
    peoplePromise,
    readinessPromise,
    myCommunitiesPromise,
  ]);
  const claimedPeople = [...peopleResult.items];
  const readiness = readinessResult.value;
  if (
    peopleResult.error &&
    readiness &&
    user &&
    !claimedPeople.some((person) => person.id === user.id)
  ) {
    const fallbackPerson = discoverPersonFromReadiness(readiness, user.id);
    if (fallbackPerson) claimedPeople.push(fallbackPerson);
  }
  const myCommunities =
    communitiesResult.error && readiness
      ? myDiscoverCommunitiesFromReadiness(readiness)
      : communitiesResult.items;
  const viewerRequestRows = user
    ? await prisma.discoverOpportunity
        .findMany({
          where: {
            sourceType: "resolve_request",
            OR: [
              { creatorId: user.id },
              { selectedProviderId: user.id },
            ],
          },
          orderBy: { updatedAt: "desc" },
          take: 40,
        })
        .catch(() => [])
    : [];
  const viewerRequests = viewerRequestRows.map((row) =>
    normalizePersistedOpportunity(row as PersistedOpportunityRow),
  );
  const viewerPools = user
    ? await loadOperatorProgramOpportunities(user.id).catch(() => [])
    : [];
  const mergedOpportunityMap = new Map<string, MarketplaceOpportunity>();
  for (const item of [...viewerRequests, ...viewerPools, ...opportunities.items]) {
    if (!mergedOpportunityMap.has(item.id)) mergedOpportunityMap.set(item.id, item);
  }
  const visibleBeforeWorkActions = [...mergedOpportunityMap.values()].map((item) => {
    if (item.marketplaceKind !== "program" || item.creator.id === user?.id)
      return item;
    return {
      ...item,
      primaryAction: workbenchAction(
        {
          id: "discover.open_program",
          label: "View Program",
          href: `/discover?view=pools&program=${encodeURIComponent(item.source.id)}`,
        },
        {
          panel: "entity_details",
          subjectId: item.source.id,
          entityType: "program",
        },
      ),
      secondaryActions: [],
    };
  });
  const requestAware = attachRequestActions(visibleBeforeWorkActions, user?.id);
  const people = mergeAttributedDiscoverPeople(
    claimedPeople,
    requestAware,
  );
  const workAware = attachVerifiedWorkActions(
    requestAware,
    people,
    user?.id,
  );
  const communities = listCommunities(workAware);
  const pools = listPools(workAware, user?.id);
  // Resolve each outcome against the funding intents that actually exist, so
  // the marketplace can state why capital may or may not fund it rather than
  // showing a bare button. Pools are unchanged by the work-action pass, so
  // they are available to match against here.
  const operatorPoolIds = new Set(
    workAware
      .filter(
        (item) =>
          item.marketplaceKind === "pool" &&
          Boolean(user?.id) &&
          item.creator.id === user?.id,
      )
      .map((item) => item.pool?.id ?? item.source.id),
  );
  const matched = attachEconomicMatch(workAware, {
    pools,
    viewerUserId: user?.id,
    operatorOfPoolIds: operatorPoolIds,
  });
  // Same canonical marketplace, ordered for who is looking at it. Ordering
  // only: nothing is dropped, so a wrong role guess can never hide a record.
  const allVisible = rankOpportunitiesForViewer(
    matched,
    viewerRole({
      operatesPools: operatorPoolIds.size > 0,
      hasSpendableCapital: false,
      hasPayoutDestination: people.some(
        (person) => person.id === user?.id && person.payoutReadiness === "ready",
      ),
    }),
    user?.id,
  );
  const liveSettlementEnabled = isLiveArcEnabled();
  const agentBlocker = liveSettlementEnabled
    ? undefined
    : getLiveBlockers()[0] ??
      "Arc Testnet USDC service payments are not available on this deployment.";
  const agentServices = discoverAgentServices().map((service) => ({
    id: service.id,
    name: service.name,
    tagline: service.tagline,
    description: service.description,
    provider: "RESOLVE",
    priceUsd: service.priceUsd,
    billingUnit: service.billingUnit,
    domain: service.domain,
    deliverables: service.deliverables,
    examplePrompt: service.examplePrompt,
    decisionContext: service.decisionContext,
    paymentRail: "Arc Testnet USDC for x402-metered service" as const,
    available: liveSettlementEnabled,
    blocker: agentBlocker,
  }));
  const capabilities = deriveUserCapabilities({
    signedIn: Boolean(user),
    payoutReady: people.some(
      (person) => person.id === user?.id && person.payoutReadiness === "ready",
    ),
    identityReady: Boolean(readiness && readiness.identities.verifiedCount > 0),
    sourceConnected: Boolean(
      readiness && readiness.github.personal.state === "connected",
    ),
    repositoryAccess: Boolean(
      readiness && readiness.github.repositoryAccess.state === "connected",
    ),
    operatesCommunity: myCommunities.some(
      (community) =>
        community.role === "owner" || community.role === "operator",
    ),
    hasPublishedProgram: allVisible.some(
      (item) =>
        item.source.type === "community_program" &&
        item.entityState?.lifecycle === "published",
    ),
    liveSettlementEnabled,
    walletReady: Boolean(
      readiness &&
      ["connected", "stale"].includes(readiness.capital.state) &&
      readiness.wallets.selectedAddress,
    ),
  });
  const inbox = buildDiscoverInbox({
    readiness,
    opportunities: allVisible,
    people,
    pools,
    myCommunities,
  });
  const activityResult =
    user && (view === "activity" || view === "for_you" || view === "outcomes")
      ? await withTimeout(
          loadPersonalDiscoverActivity(user.id, allVisible, people),
          PERSONAL_ENRICHMENT_TIMEOUT_MS,
        )
          .then((items) => ({ items, error: null as string | null }))
          .catch(() => ({
            items: [] as DiscoverActivityItem[],
            error: `Personal activity did not refresh before the ${PERSONAL_ENRICHMENT_TIMEOUT_LABEL}.`,
          }))
      : { items: [] as DiscoverActivityItem[], error: null as string | null };
  const activity = activityResult.items;
  const fallbackRecommendation = selectDiscoverRecommendation(
    readiness,
    allVisible,
  );
  const firstInbox = inbox[0];
  const allEconomicActions = rankEconomicActions(
    buildEconomicActions({
      opportunities: allVisible,
      people,
      communities,
      pools,
      myCommunities,
      viewerUserId: user?.id,
    }),
    Boolean(user),
  );
  const q = filters.q?.trim().toLowerCase();
  const economicActions = allEconomicActions
    .filter((item) => {
      if (
        view !== "outcomes" &&
        !actionMatchesIntent(item, filters.intent ?? "explore")
      )
        return false;
      if (view === "outcomes" && item.subjectType !== "receipt") return false;
      if (
        view === "activity" &&
        item.audience === "public" &&
        item.visibility === "public"
      )
        return false;
      if (
        view === "for_you" &&
        ["identity_blocker", "payout_blocker"].includes(item.subjectType) &&
        item.audience !== "contributor"
      )
        return false;
      if (
        view === "explore" &&
        !actionMatchesExploreKind(item, filters.kind ?? "all")
      )
        return false;
      if (
        filters.community &&
        item.community?.id?.toLowerCase() !== filters.community.toLowerCase() &&
        item.community?.name.toLowerCase() !== filters.community.toLowerCase()
      )
        return false;
      if (
        filters.repository &&
        item.repository?.toLowerCase() !== filters.repository.toLowerCase()
      )
        return false;
      if (!q) return true;
      return [
        item.headline,
        item.happened,
        item.whyItMatters,
        item.blocker,
        item.repository,
        item.community?.name,
        item.person?.name,
        item.source.label,
        item.receiptId,
        item.settlementId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    })
    .slice(0, view === "for_you" ? 10 : 40);
  const repositories = [
    ...new Set(myCommunities.flatMap((community) => community.repositories)),
  ];
  const sourceDiagnostics =
    view === "activity" || view === "explore" || view === "for_you" || view === "outcomes"
      ? await loadDiscoverSourceDiagnostics(readiness, repositories)
      : [];
  if (peopleResult.error) {
    sourceDiagnostics.push({
      id: "resolve:claimed-people",
      provider: "resolve",
      state: "refresh_failed",
      evaluationPeriod: "Current persisted identity state",
      eventsInspected: null,
      acceptedEvents: 0,
      lastSuccessfulAt: null,
      reason: peopleResult.error,
      stale: true,
      primaryAction: workbenchAction(
        {
          id: "source.view_status",
          label: "Review source status",
          href: "/discover?view=activity",
        },
        {
          panel: "source_sync",
          subjectId: "claimed-people",
          provider: "github",
        },
      ),
      secondaryActions: [],
    });
  }
  if (readinessResult.error) {
    sourceDiagnostics.push({
      id: "resolve:workspace-readiness",
      provider: "resolve",
      state: "refresh_failed",
      evaluationPeriod: "Current connected workspace",
      eventsInspected: null,
      acceptedEvents: 0,
      lastSuccessfulAt: null,
      reason: readinessResult.error,
      stale: true,
      primaryAction: workbenchAction(
        {
          id: "source.view_status",
          label: "Review source status",
          href: "/discover?view=activity",
        },
        {
          panel: "source_sync",
          subjectId: "workspace-readiness",
          provider: "github",
        },
      ),
      secondaryActions: [],
    });
  }
  if (communitiesResult.error) {
    sourceDiagnostics.push({
      id: "resolve:my-communities",
      provider: "resolve",
      state: "refresh_failed",
      evaluationPeriod: "Current signed-in workspace",
      eventsInspected: null,
      acceptedEvents: 0,
      lastSuccessfulAt: null,
      reason: communitiesResult.error,
      stale: true,
      primaryAction: discoverNavigationAction({
        id: "discover.open_communities",
        label: "Review community activity",
        href: "/discover?view=activity",
      }),
      secondaryActions: [],
    });
  }
  if (activityResult.error) {
    sourceDiagnostics.push({
      id: "resolve:personal-activity",
      provider: "resolve",
      state: "refresh_failed",
      evaluationPeriod: "Current signed-in activity",
      eventsInspected: null,
      acceptedEvents: 0,
      lastSuccessfulAt: null,
      reason: activityResult.error,
      stale: true,
      primaryAction: discoverNavigationAction({
        id: "discover.open_activity",
        label: "Retry personal activity",
        href: "/discover?view=activity",
      }),
      secondaryActions: [],
    });
  }
  const recommendedEconomicAction = economicActions[0];
  const filteredPeople = filters.q
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
    : people;
  const projection = buildDiscoverProjection({
    view,
    category: filters.kind ?? "all",
    inbox,
    activity,
    people: filteredPeople,
    pools,
    communities,
    opportunities: allVisible,
    agentServices,
  });

  return {
    view,
    projection,
    opportunities: { ...opportunities, items: allVisible },
    people: filteredPeople,
    communities,
    myCommunities,
    pools,
    inbox,
    economicActions,
    sourceDiagnostics,
    agentMarketplace: {
      services: agentServices,
      livePaymentsEnabled: liveSettlementEnabled,
      blocker: agentBlocker,
    },
    savedIds: [],
    signedIn: Boolean(user),
    capabilities,
    stats: {
      openOpportunities: opportunities.total || undefined,
      activeFundingUsd,
      activeCommunities:
        communities.length || myCommunities.length || undefined,
      verifiedContributors: people.length || undefined,
    },
    readiness: readiness
      ? {
          githubState: readiness.github.personal.state,
          repositoryState: readiness.github.repositoryAccess.state,
          walletState: readiness.capital.state,
          selectedWallet: readiness.wallets.selectedAddress,
          installedCommunitySlugs: readiness.communities.map(
            (item) => item.slug,
          ),
          stale: readiness.stale,
          lastConfirmedAt: readiness.lastSuccessfulAt,
          repositories: [
            ...new Set(
              myCommunities.flatMap((community) => community.repositories),
            ),
          ],
        }
      : null,
    recommendation: recommendedEconomicAction
      ? {
          id: recommendedEconomicAction.id,
          title: recommendedEconomicAction.headline,
          reason: recommendedEconomicAction.whyItMatters,
          state: recommendedEconomicAction.lifecycle,
          primaryAction: recommendedEconomicAction.primaryAction,
          secondaryActions: recommendedEconomicAction.secondaryActions,
        }
      : firstInbox
        ? {
            id: firstInbox.id,
            title: firstInbox.title,
            reason: firstInbox.why,
            state: firstInbox.state,
            primaryAction: firstInbox.primaryAction,
            secondaryActions: firstInbox.secondaryActions,
          }
        : fallbackRecommendation,
    actions: {
      directSupport:
        liveSettlementEnabled &&
        capabilities.includes("can_fund_person") &&
        people.some(
          (person) =>
            person.acceptsDirectFunding && person.payoutReadiness === "ready",
        ),
      poolFunding:
        liveSettlementEnabled &&
        capabilities.includes("can_fund_pool") &&
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
