import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  isMissingTableError,
  isPrismaUnavailableError,
} from "@/lib/db/prisma-errors";
import {
  scanAllOpportunities,
  scanFundingOpportunity,
} from "@/lib/github/opportunities";
import type { FundingOpportunity } from "@/lib/github/types";
import { invalidateDiscoverGithubCache } from "@/lib/discover/marketplace/cache";

const STALE_MS = 6 * 60 * 60_000;

export type OssScanMeta = {
  scannedAt: string;
  source: "database" | "live" | "empty";
  stale: boolean;
  staleRepositories?: string[];
};

const fundingOpportunitySchema = z.object({
  id: z.string().min(1),
  owner: z.string().min(1),
  repo: z.string().min(1),
  fullName: z.string().regex(/^[^/]+\/[^/]+$/),
  description: z
    .string()
    .nullish()
    .transform((description) => description ?? undefined),
  stars: z.number().nonnegative(),
  forks: z.number().nonnegative(),
  health: z.object({
    score: z.number(),
    grade: z.enum(["A", "B", "C", "D", "F"]),
    signals: z.array(
      z.object({
        label: z.string(),
        value: z.string(),
        impact: z.enum(["positive", "negative", "neutral"]),
      }),
    ),
    maintainerCount: z.number().nonnegative(),
    mergedPrCount: z.number().optional(),
    avgMergeDays: z.number().optional(),
    fundingGapUsd: z.number(),
    headline: z.string(),
  }),
  unfundedMaintainers: z.number().nonnegative(),
  highImpactPrs: z.number().nonnegative(),
  headline: z.string(),
  priority: z.enum(["critical", "high", "medium"]),
  live: z.boolean(),
  // Optional so previously persisted scans (written before adoption was
  // captured) still parse; a missing value means "not observed", which the
  // impact layer reports as not yet measurable.
  adoption: z
    .object({
      dependentRepoCount: z.number().nonnegative().optional(),
      source: z.string().min(1),
      observedAt: z.string().min(1),
    })
    .optional(),
  // Optional so previously persisted scans (written before advisory
  // observation existed) still parse - a missing value means "not yet
  // observed", never "no advisories exist".
  security: z
    .object({
      advisoriesWithPublishedFix: z.array(
        z.object({
          ghsaId: z.string().min(1),
          cveId: z.string().nullable(),
          patchedVersions: z.string().min(1),
          htmlUrl: z.string().url(),
        }),
      ),
      observedAt: z.string().min(1),
    })
    .optional(),
  releases: z
    .array(
      z.object({
        id: z.number(),
        tagName: z.string().min(1),
        name: z.string().nullable(),
        publishedAt: z.string().nullable(),
        htmlUrl: z.string().url(),
        author: z.string().nullable(),
        prerelease: z.boolean(),
      }),
    )
    .optional(),
  activity: z
    .object({
      observedAt: z.string(),
      rangeStart: z.string().nullable(),
      rangeEnd: z.string(),
      records: z.array(
        z.object({
          id: z.string(),
          category: z.enum([
            "code",
            "review",
            "documentation",
            "issue_resolution",
            "release_work",
            "support",
            "security",
          ]),
          title: z.string(),
          actor: z.string(),
          occurredAt: z.string(),
          sourceUrl: z.string().url(),
          sourceKind: z.enum(["pull_request", "review", "issue", "release"]),
        }),
      ),
      counts: z.record(z.string(), z.number()),
      contributors: z.array(
        z.object({
          login: z.string(),
          avatarUrl: z.string().optional(),
          acceptedActivityCount: z.number(),
          categories: z.record(z.string(), z.number()),
        }),
      ),
    })
    .optional(),
  dependencies: z
    .array(
      z.object({
        name: z.string(),
        requirement: z.string(),
        kind: z.string(),
        manifestPath: z.string(),
        sourceUrl: z.string().url(),
      }),
    )
    .optional(),
});

function rowToOpportunity(row: {
  payloadJson?: string;
  payload?: Prisma.JsonValue;
  owner: string;
  repo: string;
}): FundingOpportunity | null {
  try {
    const parsed = fundingOpportunitySchema.safeParse(
      row.payloadJson ? JSON.parse(row.payloadJson) : row.payload,
    );
    return parsed.success ? (parsed.data as FundingOpportunity) : null;
  } catch {
    return null;
  }
}

function serializableOpportunity(
  opportunity: FundingOpportunity,
): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(opportunity)) as Prisma.InputJsonValue;
}

export function fingerprintFundingOpportunity(
  opportunity: FundingOpportunity,
): string {
  const activity = opportunity.activity;
  const stable = {
    fullName: opportunity.fullName.toLowerCase(),
    stars: opportunity.stars,
    forks: opportunity.forks,
    health: opportunity.health,
    highImpactPrs: opportunity.highImpactPrs,
    unfundedMaintainers: opportunity.unfundedMaintainers,
    // Included so a change in observed downstream adoption produces a new
    // snapshot - impact accrues over time rather than being frozen at the
    // moment the work was first seen.
    adoption: opportunity.adoption
      ? {
          dependentRepoCount: opportunity.adoption.dependentRepoCount,
          source: opportunity.adoption.source,
        }
      : null,
    security: opportunity.security
      ? {
          advisoriesWithPublishedFix: opportunity.security.advisoriesWithPublishedFix.map(
            (a) => a.ghsaId,
          ),
        }
      : null,
    releases: (opportunity.releases ?? []).map((r) => ({
      id: r.id,
      tagName: r.tagName,
      publishedAt: r.publishedAt,
      prerelease: r.prerelease,
    })),
    records: (activity?.records ?? []).map((record) => ({
      id: record.id,
      title: record.title,
      category: record.category,
      actor: record.actor,
      occurredAt: record.occurredAt,
      sourceUrl: record.sourceUrl,
    })),
    contributors: (activity?.contributors ?? []).map((contributor) => ({
      login: contributor.login,
      avatarUrl: contributor.avatarUrl,
      acceptedActivityCount: contributor.acceptedActivityCount,
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

  // The immutable snapshot is the source of truth for user-requested analysis.
  // Keep the legacy aggregate cache best-effort so a missing cache table cannot
  // roll back a valid snapshot or leave Discover stuck after a GitHub scan.
  await prisma.discoverRepositorySnapshot.upsert({
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
    update: { payload, observedAt },
  });

  try {
    await prisma.githubOssScan.upsert({
      where: {
        owner_repo: { owner: opportunity.owner, repo: opportunity.repo },
      },
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
    });
  } catch (error) {
    if (!isMissingTableError(error) && !isPrismaUnavailableError(error))
      throw error;
  }

  await invalidateDiscoverGithubCache();

  return { fingerprint, observedAt: observedAt.toISOString() };
}

export async function loadRepositorySnapshotHistory(
  fullName: string,
  take = 2,
) {
  try {
    return await prisma.discoverRepositorySnapshot.findMany({
      where: { fullName },
      orderBy: [{ observedAt: "desc" }, { createdAt: "desc" }],
      take,
    });
  } catch (error) {
    if (isMissingTableError(error) || isPrismaUnavailableError(error))
      return [];
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
  type StoredRow = {
    payloadJson?: string;
    payload?: Prisma.JsonValue;
    owner: string;
    repo: string;
    fullName?: string;
    scannedAt?: Date;
    observedAt?: Date;
  };
  const rows: StoredRow[] = [];
  let aggregateUnavailable = false;
  let snapshotUnavailable = false;

  const [aggregateResult, snapshotResult] = await Promise.allSettled([
    prisma.githubOssScan.findMany({
      orderBy: { scannedAt: "desc" },
      take: 50,
      select: {
        payloadJson: true,
        owner: true,
        repo: true,
        fullName: true,
        scannedAt: true,
      },
    }),
    prisma.discoverRepositorySnapshot.findMany({
      orderBy: [{ observedAt: "desc" }, { createdAt: "desc" }],
      take: 100,
      select: {
        payload: true,
        owner: true,
        repo: true,
        fullName: true,
        observedAt: true,
      },
    }),
  ]);

  if (aggregateResult.status === "fulfilled") {
    rows.push(...aggregateResult.value);
  } else {
    const error = aggregateResult.reason;
    if (!isMissingTableError(error) && !isPrismaUnavailableError(error)) {
      throw error;
    }
    aggregateUnavailable = true;
  }

  if (snapshotResult.status === "fulfilled") {
    rows.push(...snapshotResult.value);
  } else {
    const error = snapshotResult.reason;
    if (!isMissingTableError(error) && !isPrismaUnavailableError(error)) {
      throw error;
    }
    snapshotUnavailable = true;
  }

  if (!rows.length) {
    if (aggregateUnavailable && snapshotUnavailable) {
      throw new Error(
        "GitHub evidence storage is unavailable or its required tables are missing.",
      );
    }
    return {
      opportunities: [],
      meta: {
        scannedAt: new Date(0).toISOString(),
        source: "empty",
        stale: true,
      },
    };
  }

  const byRepository = new Map<
    string,
    { opportunity: FundingOpportunity; observedAt: Date }
  >();
  for (const row of rows) {
    const opportunity = rowToOpportunity(row);
    if (!opportunity) continue;
    const observedAt = row.scannedAt ?? row.observedAt ?? new Date(0);
    const key = opportunity.fullName.toLowerCase();
    const current = byRepository.get(key);
    if (!current || observedAt > current.observedAt) {
      byRepository.set(key, { opportunity, observedAt });
    }
  }
  const selected = [...byRepository.values()].sort(
    (a, b) => b.observedAt.getTime() - a.observedAt.getTime(),
  );
  if (!selected.length) {
    throw new Error(
      "GitHub evidence storage returned records that failed runtime validation.",
    );
  }
  const newest = selected[0]!.observedAt;
  const staleRepositories = selected
    .filter((row) => Date.now() - row.observedAt.getTime() > STALE_MS)
    .map((row) => row.opportunity.fullName);
  const opportunities = selected.map((row) => row.opportunity);

  return {
    opportunities,
    meta: {
      scannedAt: newest.toISOString(),
      source: "database",
      stale: staleRepositories.length === opportunities.length,
      staleRepositories,
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

  try {
    await Promise.all(
      opportunities.map((opportunity) =>
        persistOssOpportunitySnapshot(opportunity, scannedAt),
      ),
    );
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
      meta: {
        scannedAt: new Date().toISOString(),
        source: "empty",
        stale: false,
      },
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
