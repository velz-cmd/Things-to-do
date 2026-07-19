import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isMissingTableError, isPrismaUnavailableError } from "@/lib/db/prisma-errors";
import { getProgramPoolState } from "@/lib/capital/pool-checkpoints";
import type { ProgramPoolState } from "@/lib/capital/pool-checkpoint-types";
import { resolveCommunityForRepo } from "@/lib/discover/repo-community";
import {
  fingerprintFundingOpportunity,
  loadRepositorySnapshotHistory,
  loadStoredOssOpportunities,
  type OssScanMeta,
} from "@/lib/github/oss-scan-store";
import { GITHUB_WORK_CATEGORIES } from "@/lib/github/funding-activity";
import type {
  FundingOpportunity,
  GitHubFundingActivityRecord,
  GitHubWorkCategory,
} from "@/lib/github/types";

export type DiscoverCoverageRow = {
  category: GitHubWorkCategory;
  label: string;
  activityCount: number;
  contributorCount: number;
  status: "covered" | "uncovered" | "no_activity";
  programIds: string[];
  programNames: string[];
  mechanism: string;
};

export type DiscoverRecognitionDebtRow = GitHubFundingActivityRecord & {
  reason: string;
};

export type DiscoverConcentrationRow = {
  category: GitHubWorkCategory;
  label: string;
  total: number;
  topActors: Array<{ actor: string; count: number }>;
  topTwoCount: number;
  topTwoSharePct: number;
  statement: string;
};

export type DiscoverRepositoryChange = {
  key: string;
  label: string;
  before: number | null;
  after: number;
  delta: number | null;
  unit: string;
};

export type DiscoverRepositoryOption = {
  fullName: string;
  owner: string;
  repo: string;
  stars: number;
  scannedAt: string;
};

export type DiscoverProgramSummary = {
  id: string;
  name: string;
  status: string;
  categories: GitHubWorkCategory[];
  programVersionId: string | null;
  policyVersionId: string | null;
  policyVersion: number | null;
  retroactiveMode: boolean;
  dependencySupportPercent: number;
  matchingMode: boolean;
};

export type DiscoverMilestoneCondition = {
  id: "funding" | "obligations" | "recipients" | "identity" | "policy";
  label: string;
  met: boolean;
  detail: string;
};

export type DiscoverPoolOperation = {
  programId: string;
  programName: string;
  communitySlug: string;
  programHref: string;
  fundingHref: string;
  status: string;
  policyCoverage: string[];
  payeeCategory: string;
  poolBalanceUsd: number;
  availableUsd: number;
  recognizedOwedUsd: number;
  settledUsd: number;
  claimableUsd: number;
  funderCount: number;
  contributorCount: number;
  authorizationCount: number;
  nextCheckpointUsd: number | null;
  remainingToCheckpointUsd: number;
  progressToNextPct: number;
  autoSettleEnabled: boolean;
  rationale: string;
  queuedTotalUsd: number;
  queuedPayees: Array<{ label: string; owedUsd: number }>;
  paidCheckpoints: Array<{
    id: string;
    settledUsd: number;
    payeeCount: number;
    at: string;
    checkpointThresholdUsd: number | null;
  }>;
  policyVersionId: string | null;
  policyVersion: number | null;
  distributionState: "funding" | "checkpoint_approaching" | "readiness_blocked" | "preparing_distribution" | "confirmed";
  milestoneConditions: DiscoverMilestoneCondition[];
  retroactiveMode: boolean;
  dependencySupportPercent: number;
  matchingMode: boolean;
};

export type DiscoverAttributionGraph = {
  nodes: Array<{ id: string; kind: "contributor" | "work" | "repository" | "dependency" | "program" | "pool" | "receipt"; label: string; href?: string }>;
  edges: Array<{ from: string; to: string; relation: string }>;
};

export type DiscoverOssIntelligence = {
  ok: boolean;
  repositories: DiscoverRepositoryOption[];
  selected: null | {
    fullName: string;
    owner: string;
    repo: string;
    description: string;
    sourceUrl: string;
    stars: number;
    forks: number;
    communitySlug: string;
    fingerprint: string;
    snapshotPersisted: boolean;
    observedAt: string;
    stale: boolean;
  };
  changes: {
    kind: "empty" | "baseline" | "comparison";
    currentObservedAt: string | null;
    previousObservedAt: string | null;
    rows: DiscoverRepositoryChange[];
  };
  coverage: DiscoverCoverageRow[];
  recognitionDebt: DiscoverRecognitionDebtRow[];
  concentration: DiscoverConcentrationRow[];
  funding: {
    recognizedUsd: number;
    confirmedPoolUsd: number;
    availablePoolUsd: number;
    shortfallUsd: number;
    repositoryGapEstimateUsd: number;
    eligibleRecipients: number;
    blockedRecipients: number;
    nextCheckpointUsd: number | null;
    programCount: number;
  };
  blockers: Array<{
    code: string;
    label: string;
    count: number;
    recoveryHref: string;
  }>;
  outcomes: Array<{
    receiptId: string;
    publicReference: string;
    totalUsd: number;
    payeeCount: number;
    issuedAt: string;
    txHash: string;
    chainId: number;
  }>;
  pools: DiscoverPoolOperation[];
  programs: DiscoverProgramSummary[];
  recentActivity: GitHubFundingActivityRecord[];
  proof: {
    persistedEvents: number;
    source: string;
    snapshotId: string | null;
    observedAt: string | null;
    verificationState: "persisted" | "snapshot_only" | "empty";
  };
  attributionGraph: DiscoverAttributionGraph;
  dependencies: Array<{
    name: string;
    requirement: string;
    kind: string;
    sourceUrl: string;
    splitPercent: number;
    maintainerState: "unresolved";
  }>;
  recognitionSummary: {
    uncoveredEvents: number;
    contributorCount: number;
    categories: string[];
    amountState: "verified_obligation" | "modeled_estimate" | "none";
    amountUsd: number | null;
    calculationMethod: string;
  };
  viewerSupport: {
    signedIn: boolean;
    deposits: Array<{ stakeId: string; programId: string; programName: string; amountUsd: number; status: string; createdAt: string }>;
    benefits: Array<{ id: string; programId: string; label: string; status: string; activationCheckpointUsd: number | null; activatedAt: string | null; expiresAt: string | null; limitations: string[] }>;
  };
  meta: OssScanMeta;
  degradedSources: string[];
  generatedAt: string;
};

const CATEGORY_LABELS: Record<GitHubWorkCategory, string> = {
  code: "Merged code",
  review: "Peer review",
  documentation: "Documentation",
  issue_resolution: "Issue resolution",
  release_work: "Release work",
  support: "Community support",
  security: "Security work",
};

export function buildDiscoverPoolOperation(
  pool: ProgramPoolState,
  program: DiscoverProgramSummary,
  repository?: string,
): DiscoverPoolOperation {
  const nextCheckpointUsd = pool.nextCheckpointUsd;
  const remainingToCheckpointUsd = nextCheckpointUsd === null
    ? 0
    : roundUsd(Math.max(0, nextCheckpointUsd - pool.poolBalanceUsd));
  return {
    programId: pool.programId,
    programName: pool.programName,
    communitySlug: pool.communitySlug,
    programHref: `/programs/${encodeURIComponent(pool.programId)}`,
    fundingHref: `/capital?community=${encodeURIComponent(pool.communitySlug)}&program=${encodeURIComponent(pool.programId)}&returnTo=${encodeURIComponent(repository ? `/discover?repo=${repository}` : "/discover")}`,
    status: program.status,
    policyCoverage: program.categories.map((category) => CATEGORY_LABELS[category]),
    payeeCategory: pool.payeeCategory,
    poolBalanceUsd: pool.poolBalanceUsd,
    availableUsd: pool.availableUsd,
    recognizedOwedUsd: pool.owedToCreatorsUsd,
    settledUsd: pool.settledUsd,
    claimableUsd: pool.claimableUsd,
    funderCount: pool.funderCount,
    contributorCount: pool.contributorCount,
    authorizationCount: pool.authorizationCount,
    nextCheckpointUsd,
    remainingToCheckpointUsd,
    progressToNextPct: Math.min(100, Math.max(0, pool.progressToNextPct)),
    autoSettleEnabled: pool.autoSettleEnabled,
    rationale: pool.sourcedHook,
    queuedTotalUsd: pool.nextBatchTotalUsd,
    queuedPayees: pool.nextBatchPayees.map((payee) => ({
      label: payee.label,
      owedUsd: payee.owedUsd,
    })),
    paidCheckpoints: pool.recentBatches,
    policyVersionId: program.policyVersionId,
    policyVersion: program.policyVersion,
    distributionState: pool.recentBatches.length > 0
      ? "confirmed"
      : pool.authorizationCount > 0 && pool.nextBatchPayees.length === 0
        ? "readiness_blocked"
        : pool.nextCheckpointUsd !== null && pool.poolBalanceUsd >= pool.nextCheckpointUsd && pool.nextBatchPayees.length > 0
          ? "preparing_distribution"
          : pool.poolBalanceUsd > 0
            ? "checkpoint_approaching"
            : "funding",
    milestoneConditions: [
      {
        id: "funding",
        label: "Checkpoint funding",
        met: pool.nextCheckpointUsd === null || pool.poolBalanceUsd >= pool.nextCheckpointUsd,
        detail: pool.nextCheckpointUsd === null
          ? "The configured checkpoint ladder is complete."
          : `${pool.poolBalanceUsd.toFixed(2)} of ${pool.nextCheckpointUsd.toFixed(2)} USDC funded.`,
      },
      {
        id: "obligations",
        label: "Verified obligations",
        met: pool.authorizationCount > 0,
        detail: `${pool.authorizationCount} persisted authorization${pool.authorizationCount === 1 ? "" : "s"}.`,
      },
      {
        id: "recipients",
        label: "Eligible recipients",
        met: pool.nextBatchPayees.length > 0,
        detail: `${pool.nextBatchPayees.length} payee${pool.nextBatchPayees.length === 1 ? "" : "s"} in the deterministic next queue.`,
      },
      {
        id: "identity",
        label: "Payout readiness",
        met: pool.authorizationCount === 0 || pool.nextBatchPayees.length > 0,
        detail: pool.authorizationCount > 0 && pool.nextBatchPayees.length === 0
          ? "Authorized work exists, but no payable recipient is ready."
          : "The payable queue contains only persisted authorization records.",
      },
      {
        id: "policy",
        label: "Versioned policy",
        met: Boolean(program.programVersionId && program.policyVersionId),
        detail: program.policyVersionId
          ? `Policy version ${program.policyVersion ?? "recorded"} is attached.`
          : "No active normalized policy version is attached.",
      },
    ],
    retroactiveMode: program.retroactiveMode,
    dependencySupportPercent: program.dependencySupportPercent,
    matchingMode: program.matchingMode,
  };
}

function roundUsd(value: number) {
  return Math.round(value * 100) / 100;
}

function parseObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
    } catch {
      return {};
    }
  }
  return typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function collectStrings(value: unknown, output: string[] = []): string[] {
  if (typeof value === "string") output.push(value.toLowerCase());
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, output));
  else if (value && typeof value === "object") {
    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
      output.push(key.toLowerCase());
      collectStrings(item, output);
    });
  }
  return output;
}

export function inferProgramCategories(input: {
  templateId: string;
  name: string;
  rules: unknown;
  evidenceRule?: unknown;
}): GitHubWorkCategory[] {
  const haystack = collectStrings({
    templateId: input.templateId,
    name: input.name,
    rules: input.rules,
    evidenceRule: input.evidenceRule,
  }).join(" ");
  const categories = new Set<GitHubWorkCategory>();
  if (/docs?|documentation|readme|tutorial/.test(haystack)) categories.add("documentation");
  if (/review|approval/.test(haystack)) categories.add("review");
  if (/issue|bug|resolution|triage/.test(haystack)) categories.add("issue_resolution");
  if (/release|changelog|publish/.test(haystack)) categories.add("release_work");
  if (/support|question|community help/.test(haystack)) categories.add("support");
  if (/security|cve|vulnerab/.test(haystack)) categories.add("security");
  if (/pull.request|merged.pr|github|code|commit|maintainer/.test(haystack)) categories.add("code");
  return [...categories];
}

export function buildProgramCoverage(
  opportunity: FundingOpportunity,
  programs: DiscoverProgramSummary[],
): DiscoverCoverageRow[] {
  const records = opportunity.activity?.records ?? [];
  return GITHUB_WORK_CATEGORIES.map((category) => {
    const matchingRecords = records.filter((record) => record.category === category);
    const coveringPrograms = programs.filter((program) => program.categories.includes(category));
    const contributors = new Set(matchingRecords.map((record) => record.actor.toLowerCase()));
    const status = matchingRecords.length === 0
      ? "no_activity" as const
      : coveringPrograms.length > 0
        ? "covered" as const
        : "uncovered" as const;
    return {
      category,
      label: CATEGORY_LABELS[category],
      activityCount: matchingRecords.length,
      contributorCount: contributors.size,
      status,
      programIds: coveringPrograms.map((program) => program.id),
      programNames: coveringPrograms.map((program) => program.name),
      mechanism: status === "covered"
        ? `${coveringPrograms.length} active policy ${coveringPrograms.length === 1 ? "covers" : "cover"} this work.`
        : status === "no_activity"
          ? "No accepted activity appeared in this verified snapshot."
          : `Accepted ${CATEGORY_LABELS[category].toLowerCase()} has no active matching policy.`,
    };
  });
}

export function buildRecognitionDebt(
  opportunity: FundingOpportunity,
  coverage: DiscoverCoverageRow[],
): DiscoverRecognitionDebtRow[] {
  const uncovered = new Set(
    coverage.filter((row) => row.status === "uncovered").map((row) => row.category),
  );
  return (opportunity.activity?.records ?? [])
    .filter((record) => uncovered.has(record.category))
    .map((record) => ({
      ...record,
      reason: `Accepted ${CATEGORY_LABELS[record.category].toLowerCase()} is verified, but no active policy recognizes it.`,
    }));
}

export function buildMaintainerConcentration(
  opportunity: FundingOpportunity,
): DiscoverConcentrationRow[] {
  const records = opportunity.activity?.records ?? [];
  return (["review", "release_work", "security", "documentation"] as GitHubWorkCategory[])
    .map((category) => {
      const matching = records.filter((record) => record.category === category);
      const counts = new Map<string, number>();
      matching.forEach((record) => counts.set(record.actor, (counts.get(record.actor) ?? 0) + 1));
      const topActors = [...counts.entries()]
        .map(([actor, count]) => ({ actor, count }))
        .sort((left, right) => right.count - left.count || left.actor.localeCompare(right.actor))
        .slice(0, 2);
      const topTwoCount = topActors.reduce((sum, actor) => sum + actor.count, 0);
      const topTwoSharePct = matching.length ? Math.round((topTwoCount / matching.length) * 100) : 0;
      return {
        category,
        label: CATEGORY_LABELS[category],
        total: matching.length,
        topActors,
        topTwoCount,
        topTwoSharePct,
        statement: matching.length
          ? `${topTwoCount} of ${matching.length} accepted records (${topTwoSharePct}%) came from the top two contributors.`
          : "No accepted activity in this category was observed.",
      };
    });
}

function snapshotOpportunity(value: unknown): FundingOpportunity | null {
  if (!value || typeof value !== "object") return null;
  return value as FundingOpportunity;
}

export function diffRepositorySnapshots(
  current: FundingOpportunity | null,
  previous: FundingOpportunity | null,
): DiscoverRepositoryChange[] {
  if (!current) return [];
  const metric = (opportunity: FundingOpportunity | null, category: GitHubWorkCategory) =>
    opportunity?.activity?.counts?.[category] ?? 0;
  const metrics: Array<[string, string, number, number | null, string]> = [
    ["accepted", "Accepted activity", current.activity?.records.length ?? 0, previous ? previous.activity?.records.length ?? 0 : null, "records"],
    ["contributors", "Attributed contributors", current.activity?.contributors.length ?? 0, previous ? previous.activity?.contributors.length ?? 0 : null, "people"],
    ["reviews", "Peer reviews", metric(current, "review"), previous ? metric(previous, "review") : null, "reviews"],
    ["releases", "Release work", metric(current, "release_work"), previous ? metric(previous, "release_work") : null, "records"],
    ["funding-gap", "Repository funding gap estimate", current.health.fundingGapUsd, previous ? previous.health.fundingGapUsd : null, "USD"],
    ["maintainers", "Core maintainers", current.health.maintainerCount, previous ? previous.health.maintainerCount : null, "people"],
  ];
  return metrics.map(([key, label, after, before, unit]) => ({
    key,
    label,
    before,
    after,
    delta: before === null ? null : roundUsd(after - before),
    unit,
  }));
}

export function emptyDiscoverOssIntelligence(meta?: OssScanMeta): DiscoverOssIntelligence {
  return {
    ok: true,
    repositories: [],
    selected: null,
    changes: { kind: "empty", currentObservedAt: null, previousObservedAt: null, rows: [] },
    coverage: [],
    recognitionDebt: [],
    concentration: [],
    funding: {
      recognizedUsd: 0,
      confirmedPoolUsd: 0,
      availablePoolUsd: 0,
      shortfallUsd: 0,
      repositoryGapEstimateUsd: 0,
      eligibleRecipients: 0,
      blockedRecipients: 0,
      nextCheckpointUsd: null,
      programCount: 0,
    },
    blockers: [],
    outcomes: [],
    pools: [],
    programs: [],
    recentActivity: [],
    proof: {
      persistedEvents: 0,
      source: "GitHub",
      snapshotId: null,
      observedAt: null,
      verificationState: "empty",
    },
    attributionGraph: { nodes: [], edges: [] },
    dependencies: [],
    recognitionSummary: {
      uncoveredEvents: 0,
      contributorCount: 0,
      categories: [],
      amountState: "none",
      amountUsd: null,
      calculationMethod: "No verified activity snapshot is selected.",
    },
    viewerSupport: { signedIn: false, deposits: [], benefits: [] },
    meta: meta ?? { source: "empty", scannedAt: new Date(0).toISOString(), stale: true },
    degradedSources: [],
    generatedAt: new Date().toISOString(),
  };
}

async function resilient<T>(name: string, degraded: string[], run: () => Promise<T>, fallback: T) {
  try {
    return await run();
  } catch (error) {
    if (!isMissingTableError(error) && !isPrismaUnavailableError(error)) {
      console.warn(`[discover:${name}]`, error instanceof Error ? error.message : String(error));
    }
    degraded.push(name);
    return fallback;
  }
}

async function loadViewerSupport(
  viewerUserId: string | null | undefined,
  degraded: string[],
): Promise<DiscoverOssIntelligence["viewerSupport"]> {
  if (!viewerUserId) return { signedIn: false, deposits: [], benefits: [] };
  const [stakes, benefits] = await Promise.all([
    resilient("viewer_stakes", degraded, () => prisma.communityFundStake.findMany({
      where: { userId: viewerUserId },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { program: { select: { name: true } } },
    }), []),
    resilient("supporter_benefits", degraded, () => prisma.supporterBenefitLedger.findMany({
      where: { userId: viewerUserId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }), []),
  ]);
  return {
    signedIn: true,
    deposits: stakes.map((stake) => ({
      stakeId: stake.id,
      programId: stake.programId,
      programName: stake.program.name,
      amountUsd: roundUsd(stake.principalUsd),
      status: stake.status,
      createdAt: stake.createdAt.toISOString(),
    })),
    benefits: benefits.map((benefit) => ({
      id: benefit.id,
      programId: benefit.programId,
      label: benefit.benefitLabel,
      status: benefit.status,
      activationCheckpointUsd: benefit.activationCheckpointUsd,
      activatedAt: benefit.activatedAt?.toISOString() ?? null,
      expiresAt: benefit.expiresAt?.toISOString() ?? null,
      limitations: Array.isArray(benefit.limitations)
        ? benefit.limitations.filter((value): value is string => typeof value === "string")
        : [],
    })),
  };
}

async function loadBrowseablePools(
  viewerUserId: string | null | undefined,
  degraded: string[],
): Promise<DiscoverPoolOperation[]> {
  const rows = await resilient("pool_catalog", degraded, () => prisma.resolveProgram.findMany({
    where: { status: { in: ["active", "deployed"] } },
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: {
      id: true,
      name: true,
      status: true,
      templateId: true,
      rulesJson: true,
    },
  }), []);
  if (!rows.length) return [];

  const versions = await resilient("pool_policies", degraded, () => prisma.programVersion.findMany({
    where: { programId: { in: rows.map((row) => row.id) }, status: { in: ["active", "published", "deployed"] } },
    orderBy: { version: "desc" },
  }), []);
  const versionByProgram = new Map<string, (typeof versions)[number]>();
  versions.forEach((version) => {
    if (!versionByProgram.has(version.programId)) versionByProgram.set(version.programId, version);
  });
  const policies = versions.length
    ? await resilient("pool_policies", degraded, () => prisma.policyVersion.findMany({
        where: { programVersionId: { in: versions.map((version) => version.id) } },
        orderBy: { version: "desc" },
      }), [])
    : [];
  const policyByVersion = new Map<string, (typeof policies)[number]>();
  policies.forEach((policy) => {
    if (!policyByVersion.has(policy.programVersionId)) policyByVersion.set(policy.programVersionId, policy);
  });

  const summaries = new Map<string, DiscoverProgramSummary>();
  for (const row of rows) {
    const rules = parseObject(row.rulesJson) as {
      retroactiveFunding?: { enabled?: unknown };
      dependencySupport?: { percent?: unknown };
    };
    const version = versionByProgram.get(row.id);
    const policy = version ? policyByVersion.get(version.id) : null;
    const dependencySupportPercent = typeof rules.dependencySupport?.percent === "number"
      ? Math.min(100, Math.max(0, rules.dependencySupport.percent))
      : 0;
    summaries.set(row.id, {
      id: row.id,
      name: row.name,
      status: row.status,
      categories: inferProgramCategories({
        templateId: row.templateId,
        name: row.name,
        rules,
        evidenceRule: policy?.evidenceRule,
      }),
      programVersionId: version?.id ?? null,
      policyVersionId: policy?.id ?? null,
      policyVersion: policy?.version ?? null,
      retroactiveMode: rules.retroactiveFunding?.enabled === true,
      dependencySupportPercent,
      matchingMode: row.templateId === "quadratic-funding" && Boolean(policy),
    });
  }

  const states = await Promise.all(rows.map((row) => resilient(
    `pool:${row.id}`,
    degraded,
    () => getProgramPoolState(row.id, viewerUserId),
    null,
  )));
  return states.flatMap((state) => {
    if (!state) return [];
    const summary = summaries.get(state.programId);
    return summary ? [buildDiscoverPoolOperation(state, summary)] : [];
  });
}

export async function buildDiscoverOssIntelligence(input: {
  repository?: string | null;
  viewerUserId?: string | null;
} = {}): Promise<DiscoverOssIntelligence> {
  const degradedSources: string[] = [];
  const stored = await loadStoredOssOpportunities().catch(() => ({
    opportunities: [],
    meta: { source: "empty", scannedAt: new Date(0).toISOString(), stale: true } as OssScanMeta,
  }));
  const [browseablePools, viewerSupport] = await Promise.all([
    loadBrowseablePools(input.viewerUserId, degradedSources),
    loadViewerSupport(input.viewerUserId, degradedSources),
  ]);
  if (!stored.opportunities.length) {
    return {
      ...emptyDiscoverOssIntelligence(stored.meta),
      pools: browseablePools,
      viewerSupport,
      degradedSources: [...new Set(degradedSources)],
    };
  }

  const requested = input.repository?.trim().toLowerCase();
  const selected = stored.opportunities.find((item) => item.fullName.toLowerCase() === requested)
    ?? stored.opportunities[0]!;
  const { communitySlug } = resolveCommunityForRepo(selected.owner, selected.repo);
  const history = await resilient("snapshot_history", degradedSources,
    () => loadRepositorySnapshotHistory(selected.fullName, 2), []);

  const installs = await resilient("programs", degradedSources, () => prisma.resolveCommunityInstall.findMany({
    where: { communitySlug, status: "active" },
    select: { id: true },
  }), []);
  const installIds = installs.map((install) => install.id);
  const programRows = installIds.length
    ? await resilient("programs", degradedSources, () => prisma.resolveProgram.findMany({
        where: { installId: { in: installIds }, status: { in: ["active", "deployed"] } },
        select: { id: true, name: true, status: true, templateId: true, rulesJson: true },
      }), [])
    : [];
  const programIds = programRows.map((program) => program.id);
  const programVersions = programIds.length
    ? await resilient("policies", degradedSources, () => prisma.programVersion.findMany({
        where: { programId: { in: programIds }, status: { in: ["active", "published", "deployed"] } },
        orderBy: { version: "desc" },
      }), [])
    : [];
  const policies = programVersions.length
    ? await resilient("policies", degradedSources, () => prisma.policyVersion.findMany({
        where: { programVersionId: { in: programVersions.map((version) => version.id) } },
        orderBy: { version: "desc" },
      }), [])
    : [];
  const versionByProgram = new Map<string, (typeof programVersions)[number]>();
  programVersions.forEach((version) => {
    if (!versionByProgram.has(version.programId)) versionByProgram.set(version.programId, version);
  });
  const policyByVersion = new Map<string, (typeof policies)[number]>();
  policies.forEach((policy) => {
    if (!policyByVersion.has(policy.programVersionId)) policyByVersion.set(policy.programVersionId, policy);
  });
  const programs: DiscoverProgramSummary[] = programRows.flatMap((program) => {
    const version = versionByProgram.get(program.id);
    const policy = version ? policyByVersion.get(version.id) : null;
    if (!version || !policy) return [];
    const rules = parseObject(program.rulesJson) as {
      retroactiveFunding?: { enabled?: unknown };
      dependencySupport?: { percent?: unknown };
    };
    const dependencySupportPercent = typeof rules.dependencySupport?.percent === "number"
      ? Math.min(100, Math.max(0, rules.dependencySupport.percent))
      : 0;
    return [{
      id: program.id,
      name: program.name,
      status: program.status,
      categories: inferProgramCategories({
        templateId: program.templateId,
        name: program.name,
        rules,
        evidenceRule: policy.evidenceRule,
      }),
      programVersionId: version.id,
      policyVersionId: policy.id,
      policyVersion: policy.version,
      retroactiveMode: rules.retroactiveFunding?.enabled === true,
      dependencySupportPercent,
      matchingMode: program.templateId === "quadratic-funding",
    }];
  });

  const coverage = buildProgramCoverage(selected, programs);
  const recognitionDebt = buildRecognitionDebt(selected, coverage);
  const concentration = buildMaintainerConcentration(selected);

  const obligations = await resilient("obligations", degradedSources, () => prisma.obligation.findMany({
    where: { communitySlug },
    select: {
      id: true,
      identityId: true,
      payoutDestinationId: true,
      amountUsdcMicro: true,
      status: true,
      blockerCode: true,
      recognizedAt: true,
    },
  }), []);
  const identityIds = [...new Set(obligations.flatMap((item) => item.identityId ? [item.identityId] : []))];
  const payoutIds = [...new Set(obligations.flatMap((item) => item.payoutDestinationId ? [item.payoutDestinationId] : []))];
  const [identities, payouts] = await Promise.all([
    identityIds.length
      ? resilient("identities", degradedSources, () => prisma.identity.findMany({
          where: { id: { in: identityIds } },
          select: { id: true, status: true, verifiedAt: true },
        }), [])
      : [],
    payoutIds.length
      ? resilient("payout_destinations", degradedSources, () => prisma.payoutDestination.findMany({
          where: { id: { in: payoutIds } },
          select: { id: true, status: true, verifiedAt: true },
        }), [])
      : [],
  ]);
  const identityById = new Map(identities.map((identity) => [identity.id, identity]));
  const payoutById = new Map(payouts.map((payout) => [payout.id, payout]));
  const recipientKeys = new Set<string>();
  let eligibleRecipients = 0;
  let blockedRecipients = 0;
  const blockerCounts = new Map<string, number>();
  for (const obligation of obligations) {
    const recipientKey = obligation.identityId ?? `obligation:${obligation.id}`;
    if (recipientKeys.has(recipientKey)) continue;
    recipientKeys.add(recipientKey);
    const identity = obligation.identityId ? identityById.get(obligation.identityId) : null;
    const payout = obligation.payoutDestinationId ? payoutById.get(obligation.payoutDestinationId) : null;
    const identityReady = Boolean(identity?.verifiedAt) && ["verified", "confirmed", "active"].includes(identity?.status ?? "");
    const payoutReady = Boolean(payout?.verifiedAt) && ["verified", "active"].includes(payout?.status ?? "");
    if (identityReady && payoutReady && !obligation.blockerCode) eligibleRecipients += 1;
    else {
      blockedRecipients += 1;
      const code = obligation.blockerCode ?? (!identityReady ? "identity_unresolved" : "payout_destination_unverified");
      blockerCounts.set(code, (blockerCounts.get(code) ?? 0) + 1);
    }
  }

  const poolStates = await Promise.all(programIds.map((programId) =>
    resilient(`pool:${programId}`, degradedSources, () => getProgramPoolState(programId, input.viewerUserId), null)));
  const programById = new Map(programs.map((program) => [program.id, program]));
  const selectedPools = poolStates.flatMap((pool) => {
    if (!pool) return [];
    const program = programById.get(pool.programId);
    return program ? [buildDiscoverPoolOperation(pool, program, selected.fullName)] : [];
  });
  const confirmedPoolUsd = roundUsd(poolStates.reduce((sum, pool) => sum + (pool?.totalDepositedUsd ?? 0), 0));
  const availablePoolUsd = roundUsd(poolStates.reduce((sum, pool) => sum + (pool?.availableUsd ?? 0), 0));
  const recognizedUsd = roundUsd(obligations
    .filter((item) => !["cancelled", "rejected"].includes(item.status))
    .reduce((sum, item) => sum + Number(item.amountUsdcMicro) / 1_000_000, 0));
  const nextCheckpointUsd = poolStates
    .map((pool) => pool?.nextCheckpointUsd ?? null)
    .filter((value): value is number => value !== null)
    .sort((left, right) => left - right)[0] ?? null;

  const settlementRows = await resilient("settlements", degradedSources, () => prisma.settlementBatch.findMany({
    where: { communitySlug, status: "confirmed", confirmedAt: { not: null } },
    orderBy: { confirmedAt: "desc" },
    take: 8,
  }), []);
  const settlementIds = settlementRows.map((settlement) => settlement.id);
  const receiptRows = settlementIds.length
    ? await resilient("receipts", degradedSources, () => prisma.receipt.findMany({
        where: { settlementBatchId: { in: settlementIds } },
        orderBy: { issuedAt: "desc" },
      }), [])
    : [];
  const transactionIds = receiptRows.map((receipt) => receipt.chainTransactionId);
  const transactionRows = transactionIds.length
    ? await resilient("transactions", degradedSources, () => prisma.chainTransaction.findMany({
        where: { id: { in: transactionIds }, status: "confirmed", txHash: { not: null }, confirmedAt: { not: null } },
      }), [])
    : [];
  const transactionById = new Map(transactionRows.map((transaction) => [transaction.id, transaction]));
  const outcomes = receiptRows.flatMap((receipt) => {
    const transaction = transactionById.get(receipt.chainTransactionId);
    if (!transaction?.txHash) return [];
    return [{
      receiptId: receipt.id,
      publicReference: receipt.publicReference,
      totalUsd: roundUsd(Number(receipt.totalUsdcMicro) / 1_000_000),
      payeeCount: receipt.payeeCount,
      issuedAt: receipt.issuedAt.toISOString(),
      txHash: transaction.txHash,
      chainId: transaction.chainId,
    }];
  });

  const evidenceRows = await resilient("proof_events", degradedSources, () => prisma.evidence.findMany({
    where: { subjectRef: `github:${selected.fullName.toLowerCase()}` },
    orderBy: { occurredAt: "desc" },
    take: 400,
    select: { id: true, kind: true, actorRef: true, externalId: true, sourceUrl: true, payload: true },
  }), []);

  const currentSnapshot = history[0];
  const previousSnapshot = history[1];
  const currentOpportunity = snapshotOpportunity(currentSnapshot?.payload) ?? selected;
  const previousOpportunity = snapshotOpportunity(previousSnapshot?.payload);
  const fingerprint = currentSnapshot?.fingerprint ?? fingerprintFundingOpportunity(selected);
  const currentObservedAt = currentSnapshot?.observedAt.toISOString()
    ?? selected.activity?.observedAt
    ?? stored.meta.scannedAt;

  const blockerLabels: Record<string, string> = {
    identity_unresolved: "Contributor identity needs verification",
    payout_destination_unverified: "Payout destination needs verification",
    insufficient_funding: "Confirmed funding is below recognized obligations",
  };
  if (recognizedUsd > availablePoolUsd) {
    blockerCounts.set("insufficient_funding", Math.max(1, blockerCounts.get("insufficient_funding") ?? 0));
  }

  const currentProofRows = evidenceRows.filter((row) => {
    const payload = row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
      ? row.payload as Record<string, unknown>
      : {};
    return payload.snapshotId === fingerprint;
  });
  const contributorIds = new Set(recognitionDebt.map((record) => record.actor.toLowerCase()));
  const dependencySplitPercent = Math.max(0, ...programs.map((program) => program.dependencySupportPercent));
  const dependencies = (selected.dependencies ?? []).map((dependency) => ({
    name: dependency.name,
    requirement: dependency.requirement,
    kind: dependency.kind,
    sourceUrl: dependency.sourceUrl,
    splitPercent: dependencySplitPercent,
    maintainerState: "unresolved" as const,
  }));

  const repositoryNodeId = `repository:${selected.fullName.toLowerCase()}`;
  const graphNodes: DiscoverAttributionGraph["nodes"] = [
    { id: repositoryNodeId, kind: "repository", label: selected.fullName, href: `https://github.com/${selected.fullName}` },
    ...(selected.activity?.contributors ?? []).slice(0, 24).map((contributor) => ({
      id: `contributor:${contributor.login.toLowerCase()}`,
      kind: "contributor" as const,
      label: `@${contributor.login}`,
      href: `https://github.com/${encodeURIComponent(contributor.login)}`,
    })),
    ...dependencies.slice(0, 24).map((dependency) => ({
      id: `dependency:${dependency.name}`,
      kind: "dependency" as const,
      label: dependency.name,
      href: dependency.sourceUrl,
    })),
    ...programs.map((program) => ({
      id: `program:${program.id}`,
      kind: "program" as const,
      label: program.name,
      href: `/programs/${encodeURIComponent(program.id)}`,
    })),
    ...outcomes.map((outcome) => ({
      id: `receipt:${outcome.receiptId}`,
      kind: "receipt" as const,
      label: outcome.publicReference,
      href: `/outcomes/${encodeURIComponent(outcome.publicReference)}`,
    })),
  ];
  const graphEdges: DiscoverAttributionGraph["edges"] = [
    ...(selected.activity?.contributors ?? []).slice(0, 24).map((contributor) => ({
      from: `contributor:${contributor.login.toLowerCase()}`,
      to: repositoryNodeId,
      relation: `${contributor.acceptedActivityCount} accepted proof events`,
    })),
    ...dependencies.slice(0, 24).map((dependency) => ({
      from: repositoryNodeId,
      to: `dependency:${dependency.name}`,
      relation: `${dependency.kind} dependency in package.json`,
    })),
    ...programs.map((program) => ({
      from: repositoryNodeId,
      to: `program:${program.id}`,
      relation: "evaluated by active policy",
    })),
    ...outcomes.map((outcome) => ({
      from: programs[0] ? `program:${programs[0].id}` : repositoryNodeId,
      to: `receipt:${outcome.receiptId}`,
      relation: "confirmed distribution receipt",
    })),
  ];

  return {
    ok: true,
    repositories: stored.opportunities.map((opportunity) => ({
      fullName: opportunity.fullName,
      owner: opportunity.owner,
      repo: opportunity.repo,
      stars: opportunity.stars,
      scannedAt: opportunity.activity?.observedAt ?? stored.meta.scannedAt,
    })),
    selected: {
      fullName: selected.fullName,
      owner: selected.owner,
      repo: selected.repo,
      description: selected.description ?? selected.headline,
      sourceUrl: `https://github.com/${selected.fullName}`,
      stars: selected.stars,
      forks: selected.forks,
      communitySlug,
      fingerprint,
      snapshotPersisted: Boolean(currentSnapshot),
      observedAt: currentObservedAt,
      stale: stored.meta.stale,
    },
    changes: {
      kind: previousOpportunity ? "comparison" : "baseline",
      currentObservedAt,
      previousObservedAt: previousSnapshot?.observedAt.toISOString() ?? null,
      rows: diffRepositorySnapshots(currentOpportunity, previousOpportunity),
    },
    coverage,
    recognitionDebt,
    concentration,
    funding: {
      recognizedUsd,
      confirmedPoolUsd,
      availablePoolUsd,
      shortfallUsd: roundUsd(Math.max(0, recognizedUsd - availablePoolUsd)),
      repositoryGapEstimateUsd: selected.health.fundingGapUsd,
      eligibleRecipients,
      blockedRecipients,
      nextCheckpointUsd,
      programCount: programs.length,
    },
    blockers: [...blockerCounts.entries()].map(([code, count]) => ({
      code,
      label: blockerLabels[code] ?? code.replaceAll("_", " "),
      count,
      recoveryHref: code === "insufficient_funding"
        ? `/capital?community=${encodeURIComponent(communitySlug)}&returnTo=${encodeURIComponent(`/discover?repo=${selected.fullName}`)}`
        : `/profile?section=${code === "identity_unresolved" ? "identity" : "payouts"}&returnTo=${encodeURIComponent(`/discover?repo=${selected.fullName}`)}`,
    })),
    outcomes,
    pools: browseablePools.length > 0 ? browseablePools : selectedPools,
    programs,
    recentActivity: (selected.activity?.records ?? []).slice(0, 12),
    proof: {
      persistedEvents: currentProofRows.length,
      source: "GitHub",
      snapshotId: fingerprint,
      observedAt: currentObservedAt,
      verificationState: currentProofRows.length > 0 ? "persisted" : currentSnapshot ? "snapshot_only" : "empty",
    },
    attributionGraph: { nodes: graphNodes, edges: graphEdges },
    dependencies,
    recognitionSummary: {
      uncoveredEvents: recognitionDebt.length,
      contributorCount: contributorIds.size,
      categories: [...new Set(recognitionDebt.map((record) => CATEGORY_LABELS[record.category]))],
      amountState: recognizedUsd > 0 ? "verified_obligation" : selected.health.fundingGapUsd > 0 ? "modeled_estimate" : "none",
      amountUsd: recognizedUsd > 0 ? recognizedUsd : selected.health.fundingGapUsd > 0 ? selected.health.fundingGapUsd : null,
      calculationMethod: recognizedUsd > 0
        ? "Sum of non-cancelled persisted obligations for this community."
        : selected.health.fundingGapUsd > 0
          ? "Repository sustainability model; not owed, authorized, or claimable money."
          : "No amount is available from persisted obligations or the repository model.",
    },
    viewerSupport,
    meta: stored.meta,
    degradedSources: [...new Set(degradedSources)],
    generatedAt: new Date().toISOString(),
  };
}

export function asSnapshotPayload(opportunity: FundingOpportunity): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(opportunity)) as Prisma.InputJsonValue;
}
