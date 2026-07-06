import { buildPreviewCohortPayees } from "@/lib/discover/preview-cohort-payees";
import { resolveMissionCommunitySlug } from "@/lib/mission/mission-community-slug";
import { parseCapitalUsd } from "@/lib/mission/intents";
import type { PoolBatchPayeeRow } from "@/lib/capital/pool-checkpoint-types";

export type MissionBlueprintPolicyId = "balanced" | "growth" | "infrastructure";

export type MissionBlueprintPayee = {
  label: string;
  owedUsd: number;
  source: string;
};

export type MissionBlueprintStatus = "draft" | "simulated" | "authorized";

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
  policy?: MissionBlueprintPolicyId;
  status?: MissionBlueprintStatus;
  programId?: string | null;
};

export const MISSION_POLICY_OPTIONS: Array<{
  id: MissionBlueprintPolicyId;
  label: string;
  emoji: string;
  hint: string;
}> = [
  { id: "balanced", label: "Balanced", emoji: "⚖️", hint: "Even weight across contributors" },
  { id: "growth", label: "Grow", emoji: "🚀", hint: "Bias docs + expanding contributors" },
  { id: "infrastructure", label: "Sustain core", emoji: "⚡", hint: "Bias top maintainers + infra" },
];

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

function communityLabelFromSlug(slug: string): string {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Policy reshapes payee weights before scaling to deploy budget. */
export function applyPolicyToPayees(
  payees: MissionBlueprintPayee[],
  policy: MissionBlueprintPolicyId,
  totalUsd: number,
): MissionBlueprintPayee[] {
  if (!payees.length || totalUsd <= 0) return payees;

  const weights = payees.map((_, i) => {
    if (policy === "infrastructure") {
      if (i < 3) return 1.45;
      if (i < 6) return 1.15;
      return 0.82;
    }
    if (policy === "growth") {
      if (i >= 2 && i < 7) return 1.38;
      if (i < 2) return 0.92;
      return 0.95;
    }
    return 1;
  });

  const weightSum = weights.reduce((s, w) => s + w, 0);
  const raw = payees.map((p, i) => ({
    ...p,
    owedUsd: (weights[i]! / weightSum) * totalUsd,
  }));

  const floored = raw.map((p) => ({
    ...p,
    owedUsd: Math.floor(p.owedUsd * 100) / 100,
  }));
  let remainder = Math.round((totalUsd - floored.reduce((s, p) => s + p.owedUsd, 0)) * 100);

  const order = raw
    .map((p, i) => ({ i, frac: p.owedUsd * 100 - Math.floor(p.owedUsd * 100) }))
    .sort((a, b) => b.frac - a.frac);

  const amounts = floored.map((p) => ({ ...p }));
  for (const { i } of order) {
    if (remainder <= 0) break;
    amounts[i]!.owedUsd = Math.round((amounts[i]!.owedUsd + 0.01) * 100) / 100;
    remainder -= 1;
  }

  return amounts;
}

function resolveSlug(prompt: string, communitySlug?: string | null): string {
  return (
    communitySlug ??
    resolveMissionCommunitySlug({ scopeLabel: prompt, topicName: prompt }) ??
    "react"
  );
}

function buildBasePayees(
  slug: string,
  milestoneUsd: number,
  poolPayees?: PoolBatchPayeeRow[],
): MissionBlueprintPayee[] {
  const poolRows = poolPayees?.filter((p) => p.owedUsd > 0) ?? [];
  return poolRows.length > 0
    ? payeesFromPoolRows(poolRows)
    : payeesFromPreview(slug, milestoneUsd);
}

/** Direct fund / simulate intent — no agent required. */
export function buildMissionBlueprintFromScope(input: {
  prompt: string;
  communitySlug?: string | null;
  poolPayees?: PoolBatchPayeeRow[];
  milestoneUsd?: number;
  budgetUsd?: number;
  policy?: MissionBlueprintPolicyId;
  programId?: string | null;
  poolBalanceUsd?: number;
  owedUsd?: number;
}): MissionBlueprintPackage {
  const slug = resolveSlug(input.prompt, input.communitySlug);
  const parsedBudget = parseCapitalUsd(input.prompt);
  const milestoneUsd = input.milestoneUsd ?? parsedBudget ?? 500;
  const totalCapitalUsd = input.budgetUsd ?? parsedBudget ?? milestoneUsd;
  const policy = input.policy ?? "balanced";

  const basePayees = buildBasePayees(slug, milestoneUsd, input.poolPayees);
  const payees = applyPolicyToPayees(basePayees, policy, totalCapitalUsd);
  const payeeTotal = payees.reduce((s, p) => s + p.owedUsd, 0);
  const label = communityLabelFromSlug(slug);

  const poolNote =
    input.poolBalanceUsd != null
      ? `Communal pool $${input.poolBalanceUsd.toFixed(0)}`
      : null;
  const owedNote =
    input.owedUsd != null ? `$${input.owedUsd.toFixed(0)} owed to creators` : null;

  return {
    id: `mbp-${Date.now()}`,
    objective: input.prompt.trim().slice(0, 160) || `Fund ${label} maintainers`,
    communitySlug: slug,
    communityLabel: label,
    totalCapitalUsd,
    milestoneUsd,
    payees,
    agentSignalUsd: 0,
    agentHeadline: `${label} settlement package`,
    agentDetail: [poolNote, owedNote].filter(Boolean).join(" · ") || undefined,
    findings: [
      `${payees.length} payees from verified program rules`,
      owedNote ?? `Milestone target $${milestoneUsd.toLocaleString()}`,
    ].filter(Boolean) as string[],
    recommendations: ["Simulate batch clearance", "Authorize when ready"],
    authorizationCount: payees.length,
    confidence: input.poolPayees?.length ? 0.94 : 0.88,
    rationale: `${label} · $${payeeTotal.toFixed(2)} across ${payees.length} authorizations · ${policy} policy`,
    policy,
    status: "draft",
    programId: input.programId ?? null,
  };
}

/** Turn paid agent intel into a named settlement package. */
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
  budgetUsd?: number;
  policy?: MissionBlueprintPolicyId;
  programId?: string | null;
}): MissionBlueprintPackage {
  const slug = resolveSlug(input.prompt, input.communitySlug);
  const parsedBudget = parseCapitalUsd(input.prompt);
  const milestoneUsd = input.milestoneUsd ?? parsedBudget ?? 500;
  const totalCapitalUsd = input.budgetUsd ?? parsedBudget ?? milestoneUsd;
  const policy = input.policy ?? "balanced";

  const basePayees = buildBasePayees(slug, milestoneUsd, input.poolPayees);
  const payees = applyPolicyToPayees(basePayees, policy, totalCapitalUsd);
  const payeeTotal = payees.reduce((s, p) => s + p.owedUsd, 0);
  const findings = input.findings?.filter(Boolean) ?? [];
  const recommendations = input.recommendations?.filter(Boolean) ?? [];
  const label = communityLabelFromSlug(slug);

  return {
    id: `mbp-${Date.now()}`,
    objective: input.prompt.trim().slice(0, 160) || `Fund ${label}`,
    communitySlug: slug,
    communityLabel: label,
    totalCapitalUsd,
    milestoneUsd,
    payees,
    agentSignalUsd: input.chargedUsd,
    agentHeadline: input.headline,
    agentDetail: input.detail,
    findings,
    recommendations,
    authorizationCount: payees.length,
    confidence: input.poolPayees?.length ? 0.94 : 0.86,
    rationale:
      findings[0] ??
      recommendations[0] ??
      `Agent signal (${input.chargedUsd.toFixed(3)} USDC) + ${payees.length} payees · $${payeeTotal.toFixed(2)}`,
    policy,
    status: "draft",
    programId: input.programId ?? null,
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
