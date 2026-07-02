import { prisma } from "@/lib/db";
import { getGlobalAuthorizationSummary } from "@/lib/authorization/ledger";
import { getConnectorLiveStatuses } from "@/lib/connectors/live-stats";
import { cachedScanAllOpportunities } from "@/lib/github/opportunity-cache";
import { buildNetworkIntelligence } from "@/lib/workspace/intelligence";
import { listFundableOpportunities } from "@/lib/capital/funder-discovery";
import { getTreasurySnapshot } from "@/lib/treasury/engine";
import { buildTrendingValueGaps } from "@/lib/discover/trending-gaps";
import { buildDomainRadars } from "@/lib/discover/domain-radars";
import { emptyBundle } from "@/lib/discover/domain-radar-actions";
import {
  emptyNetworkIntelligence,
  emptyRadarFeedPayload,
  safeFeedPart,
} from "@/lib/discover/radar-feed-fallback";
import type { DiscoverRadarFeedPayload } from "@/lib/discover/types";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

const GITHUB_TIMEOUT_MS = 12_000;
const TREASURY_TIMEOUT_MS = 8_000;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

/** Single Discover data source — gaps, pulse, radars, claim hint. Never throws. */
export async function buildDiscoverRadarFeed(limit = 24): Promise<DiscoverRadarFeedPayload> {
  const sinceToday = startOfToday();
  const skipGithub = process.env.CI === "true";
  const degraded: string[] = [];
  const gapLimit = Math.min(Math.max(limit, 1), 48);

  const defaultDomainRadars = {
    oss: emptyBundle("oss"),
    music: emptyBundle("music"),
    dao: emptyBundle("dao"),
  };

  const [
    ossOpportunities,
    fundable,
    ledger,
    connectors,
    eventsToday,
    treasury,
  ] = await Promise.all([
    skipGithub
      ? Promise.resolve([])
      : safeFeedPart(
          "github",
          () =>
            withTimeout(cachedScanAllOpportunities(), GITHUB_TIMEOUT_MS, []).catch(() => []),
          [],
        ),
    safeFeedPart("fundable", () => listFundableOpportunities(48), []),
    safeFeedPart("ledger", () => getGlobalAuthorizationSummary(), null),
    safeFeedPart("connectors", () => getConnectorLiveStatuses(), []),
    process.env.DATABASE_URL
      ? safeFeedPart(
          "eventsToday",
          () =>
            prisma.paymentAuthorization
              .count({ where: { createdAt: { gte: sinceToday } } })
              .catch(() => 0),
          0,
        )
      : Promise.resolve(0),
    safeFeedPart(
      "treasury",
      () =>
        withTimeout(getTreasurySnapshot(), TREASURY_TIMEOUT_MS, null).catch(() => null),
      null,
    ),
  ]);

  if (!skipGithub && ossOpportunities.length === 0) {
    degraded.push("github");
  }

  const sharedOpts = { ossOpportunities, fundable };

  const [trending, domainRadars] = await Promise.all([
    safeFeedPart(
      "trending",
      () => buildTrendingValueGaps(gapLimit, sharedOpts),
      { gaps: [], githubScanAt: null, realSignalCount: 0 },
    ),
    safeFeedPart("domainRadars", () => buildDomainRadars(sharedOpts), defaultDomainRadars),
  ]);

  if (!trending.gaps.length && !trending.realSignalCount && (eventsToday ?? 0) === 0) {
    degraded.push("trending");
  }

  const sensorsOnline = connectors.filter(
    (c) => c.health === "healthy" || c.health === "syncing",
  ).length;

  let intelligence = emptyNetworkIntelligence();
  try {
    intelligence = buildNetworkIntelligence({
      ledger,
      treasuryBalanceUsd: treasury?.balanceUsd ?? 0,
      obligationsUsd: treasury?.obligationsUsd ?? ledger?.pendingFundingUsd ?? 0,
      treasuryConfigured: treasury != null,
      domainIntelligence: [],
      opportunities: ossOpportunities,
      sensorsOnline,
      eventsToday,
    });
  } catch (e) {
    console.warn("[discover/radar-feed] intelligence build failed:", e);
    degraded.push("intelligence");
  }

  const gaps = trending.gaps;
  const radars = {
    oss: domainRadars.oss.cards.slice(0, 4),
    music: domainRadars.music.cards.slice(0, 4),
    dao: domainRadars.dao.cards.slice(0, 4),
  };

  const emptyStates = [
    domainRadars.oss.hasLiveData ? null : domainRadars.oss.emptyState,
    domainRadars.music.hasLiveData ? null : domainRadars.music.emptyState,
    domainRadars.dao.hasLiveData ? null : domainRadars.dao.emptyState,
  ].filter((s): s is NonNullable<typeof s> => s !== null);

  return {
    ok: true,
    degraded: degraded.length > 0,
    degradedParts: degraded,
    gaps,
    radars,
    domainRadars,
    emptyStates,
    intelligence,
    fundableCount: fundable.filter((f) => f.fundingGapUsd > 0).length,
    ossSignalCount: ossOpportunities.length,
    realSignalCount: trending.realSignalCount,
    githubScanAt: trending.githubScanAt,
    claimHint: null,
    updatedAt: new Date().toISOString(),
  };
}

/** Safe wrapper for API route — returns empty payload only on total failure. */
const FEED_CACHE_MS = 30_000;
let feedCache: {
  at: number;
  limit: number;
  data: DiscoverRadarFeedPayload;
} | null = null;

export async function buildDiscoverRadarFeedSafe(limit = 24): Promise<DiscoverRadarFeedPayload> {
  const bounded = Math.min(Math.max(limit, 1), 48);
  const now = Date.now();
  if (
    feedCache &&
    feedCache.limit === bounded &&
    now - feedCache.at < FEED_CACHE_MS
  ) {
    return feedCache.data;
  }

  try {
    const data = await buildDiscoverRadarFeed(bounded);
    feedCache = { at: now, limit: bounded, data };
    return data;
  } catch (e) {
    console.error("[discover/radar-feed] catastrophic:", e);
    return emptyRadarFeedPayload({
      ok: true,
      degraded: true,
      degradedParts: ["fatal"],
    });
  }
}
