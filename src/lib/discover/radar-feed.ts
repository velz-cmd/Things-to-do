import { prisma } from "@/lib/db";
import { getGlobalAuthorizationSummary } from "@/lib/authorization/ledger";
import { getConnectorLiveStatuses } from "@/lib/connectors/live-stats";
import { scanAllOpportunities } from "@/lib/github/opportunities";
import { buildNetworkIntelligence } from "@/lib/workspace/intelligence";
import { listFundableOpportunities } from "@/lib/capital/funder-discovery";
import { getTreasurySnapshot } from "@/lib/treasury/engine";
import { buildTrendingValueGaps } from "@/lib/discover/trending-gaps";
import { buildDomainRadars } from "@/lib/discover/domain-radars";
import type { DiscoverRadarFeedPayload } from "@/lib/discover/types";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Single Discover data source — gaps, pulse, radars, claim hint. */
export async function buildDiscoverRadarFeed(limit = 24): Promise<DiscoverRadarFeedPayload> {
  const sinceToday = startOfToday();
  const skipGithub = process.env.CI === "true";

  const [trending, domainRadars, ledger, connectors, ossOpportunities, fundable, eventsToday, treasury] =
    await Promise.all([
      buildTrendingValueGaps(Math.min(Math.max(limit, 1), 24)),
      buildDomainRadars(),
      getGlobalAuthorizationSummary().catch(() => null),
      getConnectorLiveStatuses().catch(() => []),
      skipGithub ? Promise.resolve([]) : scanAllOpportunities().catch(() => []),
      listFundableOpportunities(8),
      process.env.DATABASE_URL
        ? prisma.paymentAuthorization
            .count({ where: { createdAt: { gte: sinceToday } } })
            .catch(() => 0)
        : Promise.resolve(0),
      getTreasurySnapshot().catch(() => null),
    ]);

  const sensorsOnline = connectors.filter(
    (c) => c.health === "healthy" || c.health === "syncing",
  ).length;

  const intelligence = buildNetworkIntelligence({
    ledger,
    treasuryBalanceUsd: treasury?.balanceUsd ?? 0,
    obligationsUsd: treasury?.obligationsUsd ?? ledger?.pendingFundingUsd ?? 0,
    treasuryConfigured: treasury != null,
    domainIntelligence: [],
    opportunities: ossOpportunities,
    sensorsOnline,
    eventsToday,
  });

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
