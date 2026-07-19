import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isMissingTableError, isPrismaUnavailableError } from "@/lib/db/prisma-errors";
import { scanAllOpportunities, scanFundingOpportunity } from "@/lib/github/opportunities";
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

function serializableOpportunity(opportunity: FundingOpportunity): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(opportunity)) as Prisma.InputJsonValue;
}

export function fingerprintFundingOpportunity(opportunity: FundingOpportunity): string {
  const activity = opportunity.activity;
  const stable = {
    fullName: opportunity.fullName.toLowerCase(),
    stars: opportunity.stars,
    forks: opportunity.forks,
    health: opportunity.health,
    highImpactPrs: opportunity.highImpactPrs,
    unfundedMaintainers: opportunity.unfundedMaintainers,
    records: (activity?.records ?? []).map((record) => ({
      id: record.id,
      category: record.category,
      actor: record.actor,
      occurredAt: record.occurredAt,
    })),
    dependencies: (opportunity.dependencies ?? []).map((dependency) => ({
      name: dependency.name,
      requirement: dependency.requirement,
      kind: dependency.kind,
      manifestPath: dependency.manifestPath,
    })),
  };
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

export async function persistOssOpportunitySnapshot(
  opportunity: FundingOpportunity,
  observedAt = new Date(),
) {
  const fingerprint = fingerprintFundingOpportunity(opportunity);
  const payload = serializableOpportunity(opportunity);

  await prisma.$transaction([
    prisma.githubOssScan.upsert({
      where: { owner_repo: { owner: opportunity.owner, repo: opportunity.repo } },
      create: {
        owner: opportunity.owner,
        repo: opportunity.repo,
        fullName: opportunity.fullName,
        payloadJson: JSON.stringify(opportunity),
        stars: opportunity.stars,
        fundingGapUsd: opportunity.health.fundingGapUsd,
        priority: opportunity.priority,
        scannedAt: observedAt,
      },
      update: {
        fullName: opportunity.fullName,
        payloadJson: JSON.stringify(opportunity),
        stars: opportunity.stars,
        fundingGapUsd: opportunity.health.fundingGapUsd,
        priority: opportunity.priority,
        scannedAt: observedAt,
      },
    }),
    prisma.discoverRepositorySnapshot.upsert({
      where: {
        fullName_fingerprint: { fullName: opportunity.fullName, fingerprint },
      },
      create: {
        owner: opportunity.owner,
        repo: opportunity.repo,
        fullName: opportunity.fullName,
        fingerprint,
        payload,
        observedAt,
      },
      update: {},
    }),
  ]);

  return { fingerprint, observedAt: observedAt.toISOString() };
}

export async function loadRepositorySnapshotHistory(fullName: string, take = 2) {
  try {
    return await prisma.discoverRepositorySnapshot.findMany({
      where: { fullName },
      orderBy: [{ observedAt: "desc" }, { createdAt: "desc" }],
      take,
    });
  } catch (error) {
    if (isMissingTableError(error) || isPrismaUnavailableError(error)) return [];
    throw error;
  }
}

export async function refreshOssRepositoryStore(owner: string, repo: string) {
  const opportunity = await scanFundingOpportunity(owner, repo);
  if (!opportunity) return null;
  const persisted = await persistOssOpportunitySnapshot(opportunity);
  return { opportunity, ...persisted };
}

export async function loadStoredOssOpportunities(): Promise<{
  opportunities: FundingOpportunity[];
  meta: OssScanMeta;
}> {
  try {
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
  } catch (e) {
    if (isMissingTableError(e) || isPrismaUnavailableError(e)) {
      return {
        opportunities: [],
        meta: { scannedAt: new Date(0).toISOString(), source: "empty", stale: true },
      };
    }
    throw e;
  }
}

/** Cron / operator — live GitHub ingest persisted to Postgres. */
export async function refreshOssOpportunityStore(): Promise<{
  count: number;
  scannedAt: string;
}> {
  const opportunities = await scanAllOpportunities();
  const scannedAt = new Date();

  try {
    await Promise.all(opportunities.map((opportunity) => persistOssOpportunitySnapshot(opportunity, scannedAt)));
  } catch (e) {
    if (!isMissingTableError(e) && !isPrismaUnavailableError(e)) throw e;
  }

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
