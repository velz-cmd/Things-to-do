import { prisma } from "@/lib/db";
import { getGlobalAuthorizationSummary } from "@/lib/authorization/ledger";
import { getConnectorLiveStatuses } from "@/lib/connectors/live-stats";
import { cachedScanAllOpportunities } from "@/lib/github/opportunity-cache";
import { buildNetworkIntelligence } from "@/lib/workspace/intelligence";
import type { FundableOpportunity } from "@/lib/capital/community-yield";
import { getTreasurySnapshot } from "@/lib/treasury/engine";
import { buildTrendingValueGaps } from "@/lib/discover/trending-gaps";
import { buildDomainRadars } from "@/lib/discover/domain-radars";
import { emptyBundle } from "@/lib/discover/domain-radar-actions";
import {
  emptyNetworkIntelligence,
  emptyRadarFeedPayload,
  safeFeedPart,
} from "@/lib/discover/radar-feed-fallback";
import { hydrateDiscoverGaps, isUsefulDiscoverFeed } from "@/lib/discover/feed-hydration";
import type { DiscoverRadarFeedPayload } from "@/lib/discover/types";
import { cacheGetOrSet, cacheDelete, cacheReadStale } from "@/lib/cache/kv";
import { withTimeout } from "@/lib/discover/fetch-timeout";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

const GITHUB_TIMEOUT_MS = 8_000;
const TREASURY_TIMEOUT_MS = 4_000;
const LEDGER_TIMEOUT_MS = 4_000;
const CONNECTORS_TIMEOUT_MS = 4_000;
const TRENDING_TIMEOUT_MS = 6_000;
const DOMAIN_RADARS_TIMEOUT_MS = 6_000;
const EVENTS_TIMEOUT_MS = 2_000;
const FEED_BUILD_TIMEOUT_MS =
  process.env.VERCEL === "1" ? 25_000 : 12_000;

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
    safeFeedPart(
      "ledger",
      () => withTimeout(getGlobalAuthorizationSummary(), LEDGER_TIMEOUT_MS, null),
      null,
    ),
    safeFeedPart(
      "connectors",
      () => withTimeout(getConnectorLiveStatuses(), CONNECTORS_TIMEOUT_MS, []),
      [],
    ),
    process.env.DATABASE_URL
      ? safeFeedPart(
          "eventsToday",
          () =>
            withTimeout(
              prisma.paymentAuthorization
                .count({ where: { createdAt: { gte: sinceToday } } })
                .catch(() => 0),
              EVENTS_TIMEOUT_MS,
              0,
            ),
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

  const sharedOpts = { ossOpportunities, fundable: [] as FundableOpportunity[] };

  const [trending, domainRadars] = await Promise.all([
    safeFeedPart(
      "trending",
      () =>
        withTimeout(buildTrendingValueGaps(gapLimit, sharedOpts), TRENDING_TIMEOUT_MS, {
          gaps: [],
          githubScanAt: null,
          realSignalCount: 0,
        }),
      { gaps: [], githubScanAt: null, realSignalCount: 0 },
    ),
    safeFeedPart(
      "domainRadars",
      () => withTimeout(buildDomainRadars(sharedOpts), DOMAIN_RADARS_TIMEOUT_MS, defaultDomainRadars),
      defaultDomainRadars,
    ),
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

  const gaps = hydrateDiscoverGaps(trending.gaps, gapLimit);
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
    fundableCount: 0,
    ossSignalCount: ossOpportunities.length,
    realSignalCount: trending.realSignalCount,
    githubScanAt: trending.githubScanAt,
    claimHint: null,
    updatedAt: new Date().toISOString(),
  };
}

/** Safe wrapper for API route — returns empty payload only on total failure. */
const FEED_CACHE_SECONDS = 90;

export async function buildDiscoverRadarFeedSafe(limit = 24): Promise<DiscoverRadarFeedPayload> {
  const bounded = Math.min(Math.max(limit, 1), 48);
  const cacheKey = `resolve:discover:radar-feed:${bounded}`;

  const stale = await cacheReadStale<DiscoverRadarFeedPayload>(cacheKey);
  if (stale && !isUsefulDiscoverFeed(stale)) {
    await cacheDelete(cacheKey);
  }

  const buildOnce = async (): Promise<DiscoverRadarFeedPayload> => {
    try {
      const payload = await withTimeout(
        buildDiscoverRadarFeed(bounded),
        FEED_BUILD_TIMEOUT_MS,
        emptyRadarFeedPayload({
          ok: true,
          degraded: true,
          degradedParts: ["timeout"],
        }),
      );
      return {
        ...payload,
        gaps: hydrateDiscoverGaps(payload.gaps ?? [], bounded),
      };
    } catch (e) {
      console.error("[discover/radar-feed] catastrophic:", e);
      return {
        ...emptyRadarFeedPayload({
          ok: true,
          degraded: true,
          degradedParts: ["fatal"],
        }),
        gaps: hydrateDiscoverGaps([], bounded),
      };
    }
  };

  return cacheGetOrSet(cacheKey, FEED_CACHE_SECONDS, buildOnce, {
    shouldCache: isUsefulDiscoverFeed,
    validateCached: isUsefulDiscoverFeed,
  });
}
