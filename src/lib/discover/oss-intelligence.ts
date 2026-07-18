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
};

export type DiscoverPoolOperation = {
  programId: string;
  programName: string;
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

export async function buildDiscoverOssIntelligence(input: {
  repository?: string | null;
} = {}): Promise<DiscoverOssIntelligence> {
  const stored = await loadStoredOssOpportunities().catch(() => ({
    opportunities: [],
    meta: { source: "empty", scannedAt: new Date(0).toISOString(), stale: true } as OssScanMeta,
  }));
  if (!stored.opportunities.length) return emptyDiscoverOssIntelligence(stored.meta);

  const requested = input.repository?.trim().toLowerCase();
  const selected = stored.opportunities.find((item) => item.fullName.toLowerCase() === requested)
    ?? stored.opportunities[0]!;
  const { communitySlug } = resolveCommunityForRepo(selected.owner, selected.repo);
  const degradedSources: string[] = [];
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
    return [{
      id: program.id,
      name: program.name,
      status: program.status,
      categories: inferProgramCategories({
        templateId: program.templateId,
        name: program.name,
        rules: parseObject(program.rulesJson),
        evidenceRule: policy.evidenceRule,
      }),
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
    resilient(`pool:${programId}`, degradedSources, () => getProgramPoolState(programId), null)));
  const programById = new Map(programs.map((program) => [program.id, program]));
  const pools = poolStates.flatMap((pool) => {
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
    pools,
    programs,
    recentActivity: (selected.activity?.records ?? []).slice(0, 12),
    meta: stored.meta,
    degradedSources: [...new Set(degradedSources)],
    generatedAt: new Date().toISOString(),
  };
}

export function asSnapshotPayload(opportunity: FundingOpportunity): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(opportunity)) as Prisma.InputJsonValue;
}
