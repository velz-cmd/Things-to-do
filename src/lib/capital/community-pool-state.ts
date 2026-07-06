import { getCommunityBySlug } from "@/lib/communities/catalog";
import { getProgramPoolState } from "@/lib/capital/pool-checkpoints";
import { computePoolMilestoneSegment } from "@/lib/capital/pool-milestone-progress";
import { resolveCheckpointThresholds } from "@/lib/capital/pool-checkpoint-defaults";
import type { ProgramRules } from "@/lib/communities/types";
import { buildSourcedPoolHook } from "@/lib/discover/pool-discover-copy";
import type { ProgramPoolState } from "@/lib/capital/pool-checkpoint-types";
import {
  aggregateCommunityStakes,
} from "@/lib/capital/community-pool-aggregate";
import { applyCommunalTotals, viewerStakeTotals } from "@/lib/capital/community-pool-math";
import { prisma } from "@/lib/db";

function round(n: number) {
  return Math.round(n * 100) / 100;
}

/** Canonical program row for a community — highest communal stake, else highest budget. */
export async function resolveCommunalProgramId(communitySlug: string): Promise<string | null> {
  const aggregate = await aggregateCommunityStakes(communitySlug);
  return aggregate.canonicalProgramId;
}

/** One communal pool per community — never per-user program fragments. */
export async function getCommunityPoolState(
  communitySlug: string,
  _templateId: string | undefined,
  viewerUserId?: string | null,
): Promise<{ programId: string | null; pool: ProgramPoolState | null }> {
  const aggregate = await aggregateCommunityStakes(communitySlug);
  const canonicalId = aggregate.canonicalProgramId;
  if (!canonicalId) return { programId: null, pool: null };

  const base = await getProgramPoolState(canonicalId, viewerUserId);
  if (!base) return { programId: canonicalId, pool: null };

  const merged = applyCommunalTotals(base, aggregate, viewerUserId);
  const { yourDepositUsd } = viewerStakeTotals(aggregate.stakes, viewerUserId);

  const programRow = await prisma.resolveProgram.findUnique({
    where: { id: canonicalId },
    select: { rulesJson: true },
  });
  const rules = programRow?.rulesJson
    ? (JSON.parse(programRow.rulesJson) as ProgramRules)
    : ({} as ProgramRules);
  const thresholds = resolveCheckpointThresholds(rules);
  const milestone = computePoolMilestoneSegment(merged.poolBalanceUsd, thresholds);
  const nextOpenThreshold = thresholds.find((t) => merged.poolBalanceUsd < t);
  const nextCheckpointUsd: number | null =
    nextOpenThreshold != null && nextOpenThreshold <= milestone.ceilingUsd
      ? nextOpenThreshold
      : milestone.poolUsd < milestone.ceilingUsd
        ? milestone.ceilingUsd
        : (nextOpenThreshold ?? null);

  const poolSnapshotForHook = {
    programName: merged.programName,
    poolBalanceUsd: merged.poolBalanceUsd,
    owedToCreatorsUsd: merged.owedToCreatorsUsd,
    claimableUsd: merged.claimableUsd,
    nextCheckpointUsd,
    progressToNextPct: milestone.progressPct,
    payeeCategory: merged.payeeCategory,
    funderCount: merged.funderCount,
    contributorCount: merged.contributorCount,
  };

  return {
    programId: canonicalId,
    pool: {
      ...merged,
      nextCheckpointUsd,
      progressToNextPct: milestone.progressPct,
      activeMilestoneUsd: milestone.ceilingUsd,
      sourcedHook: buildSourcedPoolHook(poolSnapshotForHook),
      funder: {
        ...merged.funder,
        projectedImpactUsd:
          base.funder.projectedImpactUsd > 0 && yourDepositUsd > 0 && base.funder.yourDepositUsd > 0
            ? round(
                (yourDepositUsd / Math.max(base.funder.yourDepositUsd, 0.01)) *
                  base.funder.projectedImpactUsd,
              )
            : base.funder.projectedImpactUsd,
      },
    },
  };
}

/** Fund actions must target the communal program, not a stale per-user program id. */
export async function resolveCommunalFundTarget(input: {
  communitySlug: string;
  templateId?: string | null;
  fallbackProgramId?: string | null;
}) {
  if (!getCommunityBySlug(input.communitySlug)) return null;

  const communalId = await resolveCommunalProgramId(input.communitySlug);
  const programId = communalId ?? input.fallbackProgramId;
  if (!programId) return null;

  const program = await prisma.resolveProgram.findUnique({
    where: { id: programId },
    include: { install: { select: { communitySlug: true } } },
  });
  if (!program) return null;

  return {
    programId: program.id,
    programName: program.name,
    communitySlug: program.install?.communitySlug ?? input.communitySlug,
    templateId: program.templateId,
    missionId: program.missionId,
  };
}
