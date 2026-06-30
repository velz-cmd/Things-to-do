import { prisma } from "@/lib/db";
import { getSessionUser, ensureProfileForUser } from "@/lib/auth/session";
import { getGlobalAuthorizationSummary } from "@/lib/authorization/ledger";
import { getConnectorLiveStatuses } from "@/lib/connectors/live-stats";
import { scanAllOpportunities } from "@/lib/github/opportunities";
import { buildNetworkIntelligence } from "@/lib/workspace/intelligence";
import { listFundableOpportunities } from "@/lib/capital/funder-discovery";
import { getProfileEarningsSummary } from "@/lib/earn/summary";
import { buildTrendingValueGaps } from "@/lib/discover/trending-gaps";
import {
  gapMatchesRadar,
  RADAR_EMPTY_STATES,
} from "@/lib/discover/gap-rules";
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

  const [trending, ledger, connectors, ossOpportunities, fundable, eventsToday] =
    await Promise.all([
      buildTrendingValueGaps(Math.min(Math.max(limit, 1), 24)),
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
    oss: gaps.filter((g) => gapMatchesRadar(g, "oss")).slice(0, 4),
    music: gaps.filter((g) => gapMatchesRadar(g, "music")).slice(0, 4),
    dao: gaps.filter((g) => gapMatchesRadar(g, "dao")).slice(0, 4),
  };

  const emptyStates = [
    radars.oss.length ? null : RADAR_EMPTY_STATES.oss,
    radars.music.length ? null : RADAR_EMPTY_STATES.music,
    radars.dao.length ? null : RADAR_EMPTY_STATES.dao,
  ].filter((s): s is NonNullable<typeof s> => s !== null);

  return {
    ok: true,
    gaps,
    radars,
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
