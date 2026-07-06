import { prisma } from "@/lib/db";
import { getAuthorizationSummary } from "@/lib/authorization/ledger";
import { getProgram } from "@/lib/communities/programs";
import { computeProgramYield } from "@/lib/capital/yield-service";
import { getProgramStakePool } from "@/lib/capital/yield-service";
import { resolveCheckpointThresholds } from "@/lib/capital/pool-checkpoint-defaults";
import { parseProgramPoolMetadata } from "@/lib/capital/pool-checkpoint-metadata";
import { getProgramPeopleCounts } from "@/lib/capital/pool-people-counts";
import { buildSourcedPoolHook } from "@/lib/discover/pool-discover-copy";
import { computePoolMilestoneSegment } from "@/lib/capital/pool-milestone-progress";
import type {
  PoolCheckpointRow,
  PoolCheckpointStatus,
  ProgramPoolState,
} from "@/lib/capital/pool-checkpoint-types";

function round(n: number) {
  return Math.round(n * 100) / 100;
}

function checkpointStatus(
  thresholdUsd: number,
  poolBalanceUsd: number,
  stored: { thresholdUsd: number; status: string } | undefined,
  isNext: boolean,
): PoolCheckpointStatus {
  if (stored?.status === "paid") return "paid";
  if (poolBalanceUsd >= thresholdUsd) return stored?.status === "reached" ? "reached" : "reached";
  if (isNext && poolBalanceUsd > 0) return "active";
  return "locked";
}

/** Full pool snapshot — real USD balances + checkpoint ladder + funder position. */
export async function getProgramPoolState(
  programId: string,
  viewerUserId?: string | null,
): Promise<ProgramPoolState | null> {
  const row = await prisma.resolveProgram.findUnique({
    where: { id: programId },
    include: {
      install: { select: { communitySlug: true } },
      fundStakes: {
        where: { status: { in: ["active", "target_met"] } },
        select: {
          userId: true,
          principalUsd: true,
          releasedUsd: true,
          impactAttributedUsd: true,
        },
      },
    },
  });
  if (!row) return null;

  const program = await getProgram(row.userId, programId);
  if (!program) return null;

  const slug = row.install?.communitySlug ?? program.communitySlug;
  const rules = program.rules;
  const thresholds = resolveCheckpointThresholds(rules);
  const meta = parseProgramPoolMetadata(row.metadataJson);
  const storedByThreshold = new Map(
    (meta.checkpoints ?? []).map((c) => [c.thresholdUsd, c]),
  );

  const pool = await getProgramStakePool(programId);
  const totalDepositedUsd = round(pool.principalUsd);
  const releasedUsd = round(pool.releasedUsd);
  const availableUsd = round(pool.availableUsd);
  const poolBalanceUsd = totalDepositedUsd;

  const summary = program.missionId
    ? await getAuthorizationSummary({ missionId: program.missionId })
    : null;

  const owedToCreatorsUsd = round(
    (summary?.authorizedUsd ?? 0) + (summary?.pendingFundingUsd ?? 0),
  );
  const settledUsd = round(summary?.settledUsd ?? 0);
  const claimableUsd = round(summary?.claimableUsd ?? 0);

  const funderCount = new Set(row.fundStakes.map((s) => s.userId)).size;

  const nextOpenThreshold = thresholds.find(
    (t) =>
      poolBalanceUsd < t &&
      storedByThreshold.get(t)?.status !== "paid",
  );

  const milestone = computePoolMilestoneSegment(poolBalanceUsd, thresholds);
  const nextCheckpointUsd: number | null =
    nextOpenThreshold != null && nextOpenThreshold <= milestone.ceilingUsd
      ? nextOpenThreshold
      : milestone.poolUsd < milestone.ceilingUsd
        ? milestone.ceilingUsd
        : (nextOpenThreshold ?? null);

  const checkpoints: PoolCheckpointRow[] = thresholds.map((thresholdUsd) => {
    const stored = storedByThreshold.get(thresholdUsd);
    const isNext = nextCheckpointUsd === thresholdUsd;
    const status: PoolCheckpointStatus = checkpointStatus(
      thresholdUsd,
      poolBalanceUsd,
      stored,
      isNext,
    );
    return {
      thresholdUsd,
      status: stored?.status === "paid" ? "paid" : status,
      paidUsd: stored?.paidUsd != null ? round(stored.paidUsd) : null,
      settlementId: stored?.settlementId ?? null,
      payeeCount: stored?.payeeCount ?? null,
      triggeredAt: stored?.triggeredAt ?? null,
    };
  });

  const progressToNextPct = milestone.progressPct;

  const recentBatches = (meta.checkpoints ?? [])
    .filter((c) => c.status === "paid" && c.paidUsd != null)
    .slice(-6)
    .reverse()
    .map((c) => ({
      id: c.settlementId ?? `cp-${c.thresholdUsd}`,
      settledUsd: round(c.paidUsd ?? 0),
      payeeCount: c.payeeCount ?? 0,
      at: c.triggeredAt,
      checkpointThresholdUsd: c.thresholdUsd,
    }));

  let yourDepositUsd = 0;
  let yourReleasedUsd = 0;
  if (viewerUserId) {
    for (const s of row.fundStakes) {
      if (s.userId === viewerUserId) {
        yourDepositUsd += s.principalUsd;
        yourReleasedUsd += s.releasedUsd;
      }
    }
  }
  yourDepositUsd = round(yourDepositUsd);
  yourReleasedUsd = round(yourReleasedUsd);
  const yourSharePct =
    totalDepositedUsd > 0 ? round((yourDepositUsd / totalDepositedUsd) * 100) : 0;

  const yieldSnap = await computeProgramYield(programId);
  const projectedImpactUsd =
    yieldSnap && yieldSnap.principalFundedUsd > 0 && yourDepositUsd > 0
      ? round(
          (yourDepositUsd / yieldSnap.principalFundedUsd) *
            yieldSnap.impactValueUsd,
        )
      : 0;

  const estimatedShareOfOwedUsd =
    totalDepositedUsd > 0 && yourDepositUsd > 0
      ? round((yourDepositUsd / totalDepositedUsd) * owedToCreatorsUsd)
      : 0;

  const people = await getProgramPeopleCounts(program.id, program.missionId, program.templateId);

  const poolSnapshotForHook = {
    programName: program.name,
    poolBalanceUsd,
    owedToCreatorsUsd,
    claimableUsd,
    nextCheckpointUsd,
    progressToNextPct,
    payeeCategory: people.payeeCategory,
    funderCount,
    contributorCount: people.contributorCount,
  };

  return {
    programId,
    programName: program.name,
    communitySlug: slug,
    templateId: program.templateId,
    payeeCategory: people.payeeCategory,
    poolBalanceUsd,
    totalDepositedUsd,
    releasedUsd,
    availableUsd,
    owedToCreatorsUsd,
    settledUsd,
    claimableUsd,
    funderCount,
    contributorCount: people.contributorCount,
    authorizationCount: people.authorizationCount,
    sourcedHook: buildSourcedPoolHook(poolSnapshotForHook),
    checkpoints,
    nextCheckpointUsd,
    progressToNextPct,
    recentBatches,
    autoSettleEnabled: rules.autoSettleCheckpoints !== false,
    funder: {
      userId: viewerUserId ?? null,
      yourDepositUsd,
      yourSharePct,
      yourReleasedUsd,
      estimatedShareOfOwedUsd,
      projectedImpactUsd,
    },
  };
}

/** Programs eligible for checkpoint auto-settle (active + auto flag + mission). */
export async function listCheckpointSettleCandidates(limit = 20) {
  const programs = await prisma.resolveProgram.findMany({
    where: { status: { in: ["active", "deployed"] }, missionId: { not: null } },
    select: { id: true, userId: true },
    take: limit,
    orderBy: { updatedAt: "desc" },
  });
  return programs;
}
