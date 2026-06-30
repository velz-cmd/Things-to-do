import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, ensureProfileForUser } from "@/lib/auth/session";
import { getGlobalAuthorizationSummary } from "@/lib/authorization/ledger";
import { getConnectorLiveStatuses } from "@/lib/connectors/live-stats";
import { scanAllOpportunities } from "@/lib/github/opportunities";
import { buildNetworkIntelligence } from "@/lib/workspace/intelligence";
import { listFundableOpportunities } from "@/lib/capital/funder-discovery";
import { getProfileEarningsSummary } from "@/lib/earn/summary";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Discover tab pulse — intelligence, counts, optional claim hint (one round trip). */
export async function GET() {
  const sinceToday = startOfToday();
  const sessionUser = await getSessionUser();

  const [ledger, connectors, ossOpportunities, fundable, eventsToday] = await Promise.all([
    getGlobalAuthorizationSummary().catch(() => null),
    getConnectorLiveStatuses().catch(() => []),
    scanAllOpportunities().catch(() => []),
    listFundableOpportunities(8),
    prisma.paymentAuthorization
      .count({ where: { createdAt: { gte: sinceToday } } })
      .catch(() => 0),
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

  let claimHint: {
    claimableUsd: number;
    claimableCount: number;
    href: string;
    payeeLabel: string;
  } | null = null;

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

  return NextResponse.json({
    ok: true,
    intelligence,
    fundableCount: fundable.length,
    ossSignalCount: ossOpportunities.length,
    claimHint,
    updatedAt: new Date().toISOString(),
  });
}
