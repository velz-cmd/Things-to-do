import { prisma } from "@/lib/db";
import { resolvePublicProgramForCommunity } from "@/lib/communities/programs";
import { getProgramPoolState } from "@/lib/capital/pool-checkpoints";
import { computePoolMilestoneSegment } from "@/lib/capital/pool-milestone-progress";
import { resolveCheckpointThresholds } from "@/lib/capital/pool-checkpoint-defaults";
import type { ProgramRules } from "@/lib/communities/types";
import { buildSourcedPoolHook } from "@/lib/discover/pool-discover-copy";
import type { ProgramPoolState } from "@/lib/capital/pool-checkpoint-types";

function round(n: number) {
  return Math.round(n * 100) / 100;
}

/** One communal pool per community (+ template) — aggregate all funder stakes. */
export async function getCommunityPoolState(
  communitySlug: string,
  templateId: string | undefined,
  viewerUserId?: string | null,
): Promise<{ programId: string | null; pool: ProgramPoolState | null }> {
  const canonical = await resolvePublicProgramForCommunity(communitySlug, templateId);
  if (!canonical) return { programId: null, pool: null };

  const base = await getProgramPoolState(canonical.id, viewerUserId);
  if (!base) return { programId: canonical.id, pool: null };

  const siblingPrograms = await prisma.resolveProgram.findMany({
    where: {
      status: { in: ["active", "deployed"] },
      install: { communitySlug },
      ...(templateId ? { templateId } : {}),
    },
    select: { id: true },
  });

  const programIds = siblingPrograms.map((p) => p.id);
  if (programIds.length <= 1) {
    return { programId: canonical.id, pool: base };
  }

  const stakes = await prisma.communityFundStake.findMany({
    where: {
      programId: { in: programIds },
      status: { in: ["active", "target_met"] },
    },
    select: {
      userId: true,
      programId: true,
      principalUsd: true,
      releasedUsd: true,
    },
  });

  const totalDepositedUsd = round(stakes.reduce((s, x) => s + x.principalUsd, 0));
  const releasedUsd = round(stakes.reduce((s, x) => s + x.releasedUsd, 0));
  const availableUsd = round(Math.max(0, totalDepositedUsd - releasedUsd));
  const funderCount = new Set(stakes.map((s) => s.userId)).size;

  let yourDepositUsd = 0;
  let yourReleasedUsd = 0;
  if (viewerUserId) {
    for (const s of stakes) {
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

  const programRow = await prisma.resolveProgram.findUnique({
    where: { id: canonical.id },
    select: { rulesJson: true, metadataJson: true },
  });
  const rules = programRow?.rulesJson
    ? (JSON.parse(programRow.rulesJson) as ProgramRules)
    : ({} as ProgramRules);
  const thresholds = resolveCheckpointThresholds(rules);
  const milestone = computePoolMilestoneSegment(totalDepositedUsd, thresholds);
  const nextOpenThreshold = thresholds.find((t) => totalDepositedUsd < t);
  const nextCheckpointUsd: number | null =
    nextOpenThreshold != null && nextOpenThreshold <= milestone.ceilingUsd
      ? nextOpenThreshold
      : milestone.poolUsd < milestone.ceilingUsd
        ? milestone.ceilingUsd
        : (nextOpenThreshold ?? null);

  const estimatedShareOfOwedUsd =
    totalDepositedUsd > 0 && yourDepositUsd > 0
      ? round((yourDepositUsd / totalDepositedUsd) * base.owedToCreatorsUsd)
      : 0;

  const poolSnapshotForHook = {
    programName: base.programName,
    poolBalanceUsd: totalDepositedUsd,
    owedToCreatorsUsd: base.owedToCreatorsUsd,
    claimableUsd: base.claimableUsd,
    nextCheckpointUsd,
    progressToNextPct: milestone.progressPct,
    payeeCategory: base.payeeCategory,
    funderCount,
    contributorCount: base.contributorCount,
  };

  return {
    programId: canonical.id,
    pool: {
      ...base,
      poolBalanceUsd: totalDepositedUsd,
      totalDepositedUsd,
      releasedUsd,
      availableUsd,
      funderCount,
      nextCheckpointUsd,
      progressToNextPct: milestone.progressPct,
      activeMilestoneUsd: milestone.ceilingUsd,
      sourcedHook: buildSourcedPoolHook(poolSnapshotForHook),
      funder: {
        ...base.funder,
        yourDepositUsd,
        yourSharePct,
        yourReleasedUsd,
        estimatedShareOfOwedUsd,
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
