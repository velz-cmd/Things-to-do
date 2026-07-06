import { buildPreviewCohortPayees } from "@/lib/discover/preview-cohort-payees";
import { resolveMissionCommunitySlug } from "@/lib/mission/mission-community-slug";
import { parseCapitalUsd } from "@/lib/mission/intents";
import type { PoolBatchPayeeRow } from "@/lib/capital/pool-checkpoint-types";

export type MissionBlueprintPayee = {
  label: string;
  owedUsd: number;
  source: string;
};

export type MissionBlueprintPackage = {
  id: string;
  objective: string;
  communitySlug: string;
  communityLabel: string;
  totalCapitalUsd: number;
  milestoneUsd: number;
  payees: MissionBlueprintPayee[];
  agentSignalUsd: number;
  agentHeadline: string;
  agentDetail?: string;
  findings: string[];
  recommendations: string[];
  authorizationCount: number;
  confidence: number;
  rationale: string;
};

function payeesFromPoolRows(rows: PoolBatchPayeeRow[]): MissionBlueprintPayee[] {
  return rows.map((r) => ({
    label: r.label,
    owedUsd: r.owedUsd,
    source: "Authorization ledger",
  }));
}

function payeesFromPreview(slug: string, milestoneUsd: number): MissionBlueprintPayee[] {
  return buildPreviewCohortPayees(slug, milestoneUsd).map((p) => ({
    label: p.label,
    owedUsd: p.owedUsd,
    source: "Verified cohort · program rules",
  }));
}

/** Turn paid agent intel into a named settlement package — Mission wow artifact. */
export function buildMissionBlueprintFromAgent(input: {
  prompt: string;
  chargedUsd: number;
  headline: string;
  detail?: string;
  findings?: string[];
  recommendations?: string[];
  poolPayees?: PoolBatchPayeeRow[];
  milestoneUsd?: number;
  communitySlug?: string | null;
}): MissionBlueprintPackage {
  const slug =
    input.communitySlug ??
    resolveMissionCommunitySlug({ scopeLabel: input.prompt, topicName: input.prompt }) ??
    "react";

  const parsedBudget = parseCapitalUsd(input.prompt);
  const milestoneUsd = input.milestoneUsd ?? parsedBudget ?? 500;
  const totalCapitalUsd = parsedBudget ?? milestoneUsd;

  const poolRows = input.poolPayees?.filter((p) => p.owedUsd > 0) ?? [];
  const payees =
    poolRows.length > 0
      ? payeesFromPoolRows(poolRows)
      : payeesFromPreview(slug, milestoneUsd);

  const payeeTotal = payees.reduce((s, p) => s + p.owedUsd, 0);
  const findings = input.findings?.filter(Boolean) ?? [];
  const recommendations = input.recommendations?.filter(Boolean) ?? [];

  const communityLabel = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    id: `mbp-${Date.now()}`,
    objective: input.prompt.trim().slice(0, 160) || `Fund ${communityLabel}`,
    communitySlug: slug,
    communityLabel,
    totalCapitalUsd,
    milestoneUsd,
    payees,
    agentSignalUsd: input.chargedUsd,
    agentHeadline: input.headline,
    agentDetail: input.detail,
    findings,
    recommendations,
    authorizationCount: payees.length,
    confidence: poolRows.length > 0 ? 0.94 : 0.86,
    rationale:
      findings[0] ??
      recommendations[0] ??
      `Agent signal (${input.chargedUsd.toFixed(3)} USDC) + ${payees.length} verified payees · $${payeeTotal.toFixed(2)} at ${milestoneUsd} milestone`,
  };
}

export function simulateBlueprintPackage(pkg: MissionBlueprintPackage): {
  clearedAuthorizations: number;
  totalPayeeUsd: number;
  surplusUsd: number;
  checkpointReached: boolean;
} {
  const totalPayeeUsd = pkg.payees.reduce((s, p) => s + p.owedUsd, 0);
  const clearedAuthorizations = pkg.payees.filter((p) => p.owedUsd > 0).length;
  const surplusUsd = Math.max(0, pkg.totalCapitalUsd - totalPayeeUsd);
  return {
    clearedAuthorizations,
    totalPayeeUsd,
    surplusUsd,
    checkpointReached: pkg.totalCapitalUsd >= pkg.milestoneUsd,
  };
}
