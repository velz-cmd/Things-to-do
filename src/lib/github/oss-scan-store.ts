import { prisma } from "@/lib/db";
import { scanAllOpportunities } from "@/lib/github/opportunities";
import type { FundingOpportunity } from "@/lib/github/types";

const STALE_MS = 6 * 60 * 60_000;

export type OssScanMeta = {
  scannedAt: string;
  source: "database" | "live" | "empty";
  stale: boolean;
};

function rowToOpportunity(row: {
  payloadJson: string;
  owner: string;
  repo: string;
}): FundingOpportunity | null {
  try {
    return JSON.parse(row.payloadJson) as FundingOpportunity;
  } catch {
    return null;
  }
}

export async function loadStoredOssOpportunities(): Promise<{
  opportunities: FundingOpportunity[];
  meta: OssScanMeta;
}> {
  const rows = await prisma.githubOssScan.findMany({
    orderBy: { scannedAt: "desc" },
  });

  if (!rows.length) {
    return {
      opportunities: [],
      meta: { scannedAt: new Date(0).toISOString(), source: "empty", stale: true },
    };
  }

  const newest = rows[0]!.scannedAt;
  const stale = Date.now() - newest.getTime() > STALE_MS;
  const opportunities = rows
    .map(rowToOpportunity)
    .filter((o): o is FundingOpportunity => o !== null);

  return {
    opportunities,
    meta: {
      scannedAt: newest.toISOString(),
      source: "database",
      stale,
    },
  };
}

/** Cron / operator — live GitHub ingest persisted to Postgres. */
export async function refreshOssOpportunityStore(): Promise<{
  count: number;
  scannedAt: string;
}> {
  const opportunities = await scanAllOpportunities();
  const scannedAt = new Date();

  await Promise.all(
    opportunities.map((o) =>
      prisma.githubOssScan.upsert({
        where: { owner_repo: { owner: o.owner, repo: o.repo } },
        create: {
          owner: o.owner,
          repo: o.repo,
          fullName: o.fullName,
          payloadJson: JSON.stringify(o),
          stars: o.stars,
          fundingGapUsd: o.health.fundingGapUsd,
          priority: o.priority,
          scannedAt,
        },
        update: {
          fullName: o.fullName,
          payloadJson: JSON.stringify(o),
          stars: o.stars,
          fundingGapUsd: o.health.fundingGapUsd,
          priority: o.priority,
          scannedAt,
        },
      }),
    ),
  );

  return { count: opportunities.length, scannedAt: scannedAt.toISOString() };
}

/** User-facing read — DB first; live scan only when store empty and not CI. */
export async function readOssOpportunitiesForDiscover(): Promise<{
  opportunities: FundingOpportunity[];
  meta: OssScanMeta;
}> {
  if (process.env.CI === "true") {
    return {
      opportunities: [],
      meta: { scannedAt: new Date().toISOString(), source: "empty", stale: false },
    };
  }

  const stored = await loadStoredOssOpportunities();
  if (stored.opportunities.length > 0) {
    return stored;
  }

  if (process.env.ALLOW_LIVE_GITHUB_SCAN === "true") {
    const live = await scanAllOpportunities().catch(() => []);
    if (live.length) {
      await refreshOssOpportunityStore().catch(() => null);
    }
    return {
      opportunities: live,
      meta: {
        scannedAt: new Date().toISOString(),
        source: "live",
        stale: false,
      },
    };
  }

  return stored;
}
