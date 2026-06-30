import { prisma } from "@/lib/db";
import { getSessionUser, ensureProfileForUser } from "@/lib/auth/session";
import { getGlobalAuthorizationSummary } from "@/lib/authorization/ledger";
import { getConnectorLiveStatuses } from "@/lib/connectors/live-stats";
import { scanAllOpportunities } from "@/lib/github/opportunities";
import { buildNetworkIntelligence } from "@/lib/workspace/intelligence";
import { listFundableOpportunities } from "@/lib/capital/funder-discovery";
import { getProfileEarningsSummary } from "@/lib/earn/summary";
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
  const sessionUser = await getSessionUser();

  const [trending, domainRadars, ledger, connectors, ossOpportunities, fundable, eventsToday] =
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
    ]);

  const sensorsOnline = connectors.filter(
    (c) => c.health === "healthy" || c.health === "syncing",
  ).length;

  const intelligence = buildNetworkIntelligence({
    ledger,
    treasuryBalanceUsd: 0,
    obligationsUsd: ledger?.pendingFundingUsd ?? 0,
    domainIntelligence: [],
    opportunities: ossOpportunities,
    sensorsOnline,
    eventsToday,
  });

  let claimHint: DiscoverRadarFeedPayload["claimHint"] = null;
  if (sessionUser) {
    const profile = await ensureProfileForUser(sessionUser);
    const earnings = await getProfileEarningsSummary({ profile });
    if (earnings.claimableUsd > 0) {
      claimHint = {
        claimableUsd: earnings.claimableUsd,
        claimableCount: earnings.identities.filter((i) => i.claimableUsd > 0).length,
        href: "/claim",
        payeeLabel: profile.displayName ?? sessionUser.email ?? "your account",
      };
    }
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
    gaps,
    radars,
    domainRadars,
    emptyStates,
    intelligence,
    fundableCount: fundable.filter((f) => f.fundingGapUsd > 0).length,
    ossSignalCount: ossOpportunities.length,
    realSignalCount: trending.realSignalCount,
    githubScanAt: trending.githubScanAt,
    claimHint,
    updatedAt: new Date().toISOString(),
  };
}
