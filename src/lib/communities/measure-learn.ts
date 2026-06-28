import { prisma } from "@/lib/db";
import { getAuthorizationSummary } from "@/lib/authorization/ledger";
import { getProgram, updateProgram } from "@/lib/communities/programs";
import { recordTimelineEvent } from "@/lib/mission/server/timeline";
import type { ProgramRules } from "./types";

export type MeasureMetrics = {
  authorizedUsd: number;
  settledUsd: number;
  claimableUsd: number;
  playCount: number;
  artistCount: number;
  settlementRate: number;
  budgetUtilization: number;
  avgPerPlayUsd: number;
  lastDeployAt: string | null;
};

export type RebalanceRecommendation = {
  id: string;
  severity: "critical" | "watch" | "positive";
  action: string;
  reason: string;
  suggestedRules?: Partial<ProgramRules>;
};

export type MeasureLearnReport = {
  programId: string;
  communitySlug: string;
  programName: string;
  loopPhase: "measure" | "learn";
  metrics: MeasureMetrics;
  recommendations: RebalanceRecommendation[];
  applied: boolean;
  appliedChange?: Partial<ProgramRules>;
};

function round(n: number) {
  return Math.round(n * 10_000) / 10_000;
}

/** Measure — ingest outcomes from ledger + settlements */
export async function measureProgramOutcomes(
  userId: string,
  programId: string,
): Promise<MeasureLearnReport | null> {
  const program = await getProgram(userId, programId);
  if (!program?.missionId) return null;

  const summary = await getAuthorizationSummary({
    missionId: program.missionId,
    connectorId: program.rules.connectorId,
  });

  const authorizedUsd = summary.authorizedUsd + summary.pendingFundingUsd;
  const settledUsd = summary.settledUsd;
  const claimableUsd = summary.claimableUsd;
  const playCount = summary.count;
  const artists = new Set(summary.authorizations.map((a) => a.payeeKey));
  const settlementRate = authorizedUsd > 0 ? settledUsd / authorizedUsd : 0;
  const budgetUtilization = program.budgetUsd > 0 ? authorizedUsd / program.budgetUsd : 0;
  const perPlay = program.rules.perPlayUsd ?? 0.0004;
  const avgPerPlayUsd = playCount > 0 ? authorizedUsd / playCount : perPlay;

  const metrics: MeasureMetrics = {
    authorizedUsd: round(authorizedUsd),
    settledUsd: round(settledUsd),
    claimableUsd: round(claimableUsd),
    playCount,
    artistCount: artists.size,
    settlementRate: round(settlementRate),
    budgetUtilization: round(budgetUtilization),
    avgPerPlayUsd: round(avgPerPlayUsd),
    lastDeployAt: program.lastDeployAt,
  };

  const recommendations: RebalanceRecommendation[] = [];

  if (playCount === 0) {
    recommendations.push({
      id: "sync-scrobbles",
      severity: "watch",
      action: "Sync scrobble bridge",
      reason: "No verified plays in ledger — run navidrome-bridge.ts with program missionId",
    });
  }

  if (authorizedUsd > 0 && settlementRate < 0.25) {
    recommendations.push({
      id: "fund-treasury",
      severity: "critical",
      action: "Fund treasury",
      reason: `$${authorizedUsd.toFixed(2)} authorized but only ${Math.round(settlementRate * 100)}% settled`,
    });
  }

  if (claimableUsd > authorizedUsd * 0.3 && claimableUsd > 0) {
    recommendations.push({
      id: "wallet-mapping",
      severity: "watch",
      action: "Improve wallet mapping",
      reason: `$${claimableUsd.toFixed(2)} claimable — artists need linked wallets`,
    });
  }

  if (budgetUtilization > 0.85 && program.rules.perPlayUsd) {
    recommendations.push({
      id: "reduce-per-play",
      severity: "watch",
      action: "Reduce per-play rate",
      reason: "Program budget nearly exhausted at current play volume",
      suggestedRules: { perPlayUsd: round(perPlay * 0.9) },
    });
  }

  if (budgetUtilization < 0.15 && playCount > 50 && program.rules.perPlayUsd) {
    recommendations.push({
      id: "increase-per-play",
      severity: "positive",
      action: "Increase per-play rate",
      reason: "Budget underutilized with steady play volume — room to reward artists",
      suggestedRules: { perPlayUsd: round(Math.min(perPlay * 1.1, 0.002)) },
    });
  }

  if (settlementRate >= 0.5 && playCount > 10) {
    recommendations.push({
      id: "outcome-positive",
      severity: "positive",
      action: "Loop closing",
      reason: `${playCount} plays → $${settledUsd.toFixed(2)} settled on Arc`,
    });
  }

  return {
    programId,
    communitySlug: program.communitySlug,
    programName: program.name,
    loopPhase: "measure",
    metrics,
    recommendations,
    applied: false,
  };
}

/** Learn — apply one evidence-backed rule adjustment */
export async function learnAndRebalanceProgram(
  userId: string,
  programId: string,
): Promise<MeasureLearnReport | { ok: false; error: string }> {
  const report = await measureProgramOutcomes(userId, programId);
  if (!report) return { ok: false, error: "Program not found" };

  const actionable = report.recommendations.find((r) => r.suggestedRules);
  if (!actionable?.suggestedRules) {
    return {
      ...report,
      loopPhase: "learn",
      applied: false,
    };
  }

  const result = await updateProgram(userId, programId, {
    rules: actionable.suggestedRules,
    status: "active",
  });

  if (!result.ok) return { ok: false, error: result.error ?? "Update failed" };

  const install = await prisma.resolveCommunityInstall.findFirst({
    where: { userId, communitySlug: report.communitySlug },
  });

  await recordTimelineEvent({
    userId,
    ecosystemId: install?.ecosystemId ?? undefined,
    eventType: "program_rebalanced",
    title: `Learned · ${actionable.action}`,
    detail: actionable.reason,
    severity: "info",
    metadata: { programId, rules: actionable.suggestedRules },
  });

  return {
    ...report,
    loopPhase: "learn",
    applied: true,
    appliedChange: actionable.suggestedRules,
  };
}

export async function measureAllPrograms(userId: string) {
  const installs = await prisma.resolveCommunityInstall.findMany({
    where: { userId },
    include: { programs: true },
  });

  const reports: MeasureLearnReport[] = [];
  for (const install of installs) {
    for (const program of install.programs) {
      const r = await measureProgramOutcomes(userId, program.id);
      if (r) reports.push(r);
    }
  }
  return reports;
}
