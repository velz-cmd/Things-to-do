import { prisma } from "@/lib/db";
import { getCommunityBySlug } from "@/lib/communities/catalog";
import { getAuthorizationSummary } from "@/lib/authorization/ledger";
import { measureProgramOutcomes } from "@/lib/communities/measure-learn";
import {
  computeProgramImpactValue,
  computeYieldMultiplier,
  DEFAULT_TARGET_YIELD_MULTIPLIER,
  fundingGapForTarget,
  type FunderStakeYield,
  type ProgramYieldSnapshot,
} from "@/lib/capital/community-yield";

function round(n: number) {
  return Math.round(n * 100) / 100;
}

export async function getProgramStakePool(programId: string) {
  const stakes = await prisma.communityFundStake.findMany({
    where: { programId, status: { in: ["active", "target_met"] } },
  });
  const principalUsd = stakes.reduce((s, x) => s + x.principalUsd, 0);
  const releasedUsd = stakes.reduce((s, x) => s + x.releasedUsd, 0);
  const availableUsd = Math.max(0, principalUsd - releasedUsd);
  return { stakes, principalUsd: round(principalUsd), releasedUsd: round(releasedUsd), availableUsd };
}

export async function computeProgramYield(programId: string): Promise<ProgramYieldSnapshot | null> {
  const program = await prisma.resolveProgram.findUnique({
    where: { id: programId },
    include: { install: { select: { communitySlug: true } } },
  });
  if (!program?.missionId) return null;

  const summary = await getAuthorizationSummary({ missionId: program.missionId });
  const pool = await getProgramStakePool(programId);
  const ownerFunded = Math.max(0, program.budgetUsd - pool.principalUsd);
  const principalFundedUsd = round(pool.principalUsd + ownerFunded);

  const impact = computeProgramImpactValue({
    settledUsd: summary.settledUsd,
    claimableUsd: summary.claimableUsd,
    authorizedUsd: summary.authorizedUsd + summary.pendingFundingUsd,
    contributorCount: new Set(summary.authorizations.map((a) => a.payeeKey)).size,
  });

  const yieldMultiplier = computeYieldMultiplier(impact.total, principalFundedUsd);
  const targetMultiplier = DEFAULT_TARGET_YIELD_MULTIPLIER;

  return {
    programId,
    missionId: program.missionId,
    impactValueUsd: impact.total,
    principalFundedUsd,
    yieldMultiplier,
    targetMultiplier,
    targetMet: yieldMultiplier >= targetMultiplier,
    fundingGapUsd: fundingGapForTarget(impact.total, principalFundedUsd, targetMultiplier),
    breakdown: impact.breakdown,
  };
}

export async function attributeImpactToStakes(programId: string, impactValueUsd: number) {
  const pool = await getProgramStakePool(programId);
  if (!pool.principalUsd || !pool.stakes.length) return;

  for (const stake of pool.stakes) {
    const share = stake.principalUsd / pool.principalUsd;
    const attributed = round(impactValueUsd * share);
    const multiplier = computeYieldMultiplier(attributed, stake.principalUsd);
    const targetMet = multiplier >= stake.targetYieldMultiplier;

    await prisma.communityFundStake.update({
      where: { id: stake.id },
      data: {
        impactAttributedUsd: attributed,
        status: targetMet ? "target_met" : stake.status,
      },
    });
  }
}

export async function debitStakePool(programId: string, amountUsd: number) {
  const pool = await getProgramStakePool(programId);
  if (pool.availableUsd < 0.01 || amountUsd < 0.01) {
    return { fromStakes: 0, fromOwner: amountUsd };
  }

  const fromStakes = Math.min(amountUsd, pool.availableUsd);
  let remaining = fromStakes;

  for (const stake of pool.stakes) {
    if (remaining < 0.0001) break;
    const stakeAvailable = stake.principalUsd - stake.releasedUsd;
    if (stakeAvailable < 0.0001) continue;
    const debit = Math.min(remaining, stakeAvailable);
    await prisma.communityFundStake.update({
      where: { id: stake.id },
      data: { releasedUsd: { increment: debit } },
    });
    remaining -= debit;
  }

  return {
    fromStakes: round(fromStakes - remaining),
    fromOwner: round(amountUsd - (fromStakes - remaining)),
  };
}

export async function listFunderPortfolio(userId: string): Promise<FunderStakeYield[]> {
  const stakes = await prisma.communityFundStake.findMany({
    where: { userId },
    include: {
      program: {
        include: { install: { select: { communitySlug: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const out: FunderStakeYield[] = [];
  for (const stake of stakes) {
    const slug = stake.program.install?.communitySlug ?? "unknown";
    const community = getCommunityBySlug(slug);
    const yieldSnap = await computeProgramYield(stake.programId);
    const share =
      yieldSnap && yieldSnap.principalFundedUsd > 0 ?
        stake.principalUsd / yieldSnap.principalFundedUsd
      : 0;
    const attributed = round((yieldSnap?.impactValueUsd ?? stake.impactAttributedUsd) * share);
    const multiplier = computeYieldMultiplier(attributed, stake.principalUsd);

    out.push({
      stakeId: stake.id,
      programId: stake.programId,
      programName: stake.program.name,
      communitySlug: slug,
      communityName: community?.name ?? slug,
      principalUsd: stake.principalUsd,
      releasedUsd: stake.releasedUsd,
      attributedImpactUsd: attributed,
      yieldMultiplier: multiplier,
      targetMultiplier: stake.targetYieldMultiplier,
      targetMet: multiplier >= stake.targetYieldMultiplier,
      status: stake.status,
      fundedAt: stake.createdAt.toISOString(),
    });
  }
  return out;
}

export async function refreshProgramYieldCache(programId: string) {
  const snap = await computeProgramYield(programId);
  if (snap) await attributeImpactToStakes(programId, snap.impactValueUsd);
  return snap;
}

/** Measure-backed snapshot for discovery cards */
export async function programDiscoveryMetrics(programId: string, ownerUserId: string) {
  const measure = await measureProgramOutcomes(ownerUserId, programId);
  const yieldSnap = await computeProgramYield(programId);
  const summary = yieldSnap?.missionId ?
    await getAuthorizationSummary({ missionId: yieldSnap.missionId })
  : null;

  return {
    measure,
    yield: yieldSnap,
    signalCount: summary?.count ?? 0,
    contributorCount: summary ?
      new Set(summary.authorizations.map((a) => a.payeeKey)).size
    : 0,
  };
}
