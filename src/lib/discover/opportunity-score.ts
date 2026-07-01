import type { DiscoverDataSource } from "@/lib/discover/types";

/** Matches OSS_CAP_USD in valuation-eligibility — estimates never exceed this in reward score */
const ESTIMATE_REWARD_CAP = 25_000;

export type OpportunityScoreDimension =
  | "reward"
  | "difficulty"
  | "urgency"
  | "confidence"
  | "time"
  | "impact";

export type ScoreProvenance = "ledger" | "estimate" | "program" | "sensor" | "heuristic";

export type OpportunityScoreChip = {
  dimension: OpportunityScoreDimension;
  label: string;
  /** 0–100 — higher is more attractive for funders (difficulty inverted: high = easy) */
  value: number;
  display: string;
  provenance: ScoreProvenance;
  source: string;
};

export type OpportunityScorecard = {
  composite: number;
  chips: OpportunityScoreChip[];
};

export type OpportunityScoreInput = {
  amountNeededUsd: number;
  moneyCanMoveUsd?: number;
  amountVerified: boolean;
  amountKind?: "ledger" | "estimate";
  dataSource?: DiscoverDataSource;
  peopleImpacted?: number;
  contributorCount?: number;
  signalCount?: number;
  settlementRate?: number;
  fundingGapUsd?: number;
  pendingFundingUsd?: number;
  updatedAt?: string;
  proofAuthorizationId?: string;
  proofConnectorId?: string;
  templateId?: string;
  domain?: string;
  programCount?: number;
  sensorLive?: boolean;
  sensorGated?: boolean;
  maintainerCount?: number;
  yieldMultiplier?: number;
};

const LEDGER_REWARD_CAP = 50_000;

const SETTLEMENT_DAYS: Record<string, number> = {
  "user-centric-royalties": 7,
  "video-royalties": 7,
  "docs-bounty": 14,
  "security-fund": 21,
  "citation-toll": 10,
  "quadratic-funding": 30,
};

const DIMENSION_LABELS: Record<OpportunityScoreDimension, string> = {
  reward: "Reward",
  difficulty: "Difficulty",
  urgency: "Urgency",
  confidence: "Confidence",
  time: "Time",
  impact: "Impact",
};

function clamp(n: number, min = 0, max = 100): number {
  return Math.round(Math.min(max, Math.max(min, n)));
}

function formatUsd(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  if (n >= 1) return `$${n.toFixed(0)}`;
  return `$${n.toFixed(2)}`;
}

function daysSince(iso?: string): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, (Date.now() - t) / 86_400_000);
}

function scoreReward(input: OpportunityScoreInput): OpportunityScoreChip {
  const gap = input.fundingGapUsd ?? input.amountNeededUsd;
  const pending = input.pendingFundingUsd ?? 0;
  const rewardUsd = input.amountVerified
    ? Math.max(gap, pending, input.moneyCanMoveUsd ?? 0)
    : Math.min(gap, ESTIMATE_REWARD_CAP);

  const cap = input.amountVerified ? LEDGER_REWARD_CAP : ESTIMATE_REWARD_CAP;
  const normalized = clamp((Math.log10(rewardUsd + 1) / Math.log10(cap + 1)) * 100);
  const provenance: ScoreProvenance = input.amountVerified
    ? input.proofAuthorizationId
      ? "ledger"
      : "program"
    : "estimate";

  const source = input.amountVerified
    ? input.proofConnectorId
      ? `${input.proofConnectorId} authorization`
      : "Program ledger"
    : `Capped estimate · max ${formatUsd(ESTIMATE_REWARD_CAP)}`;

  return {
    dimension: "reward",
    label: DIMENSION_LABELS.reward,
    value: input.amountVerified ? normalized : Math.min(normalized, 72),
    display: formatUsd(rewardUsd),
    provenance,
    source,
  };
}

function scoreDifficulty(input: OpportunityScoreInput): OpportunityScoreChip {
  const maintainers = input.maintainerCount ?? input.peopleImpacted ?? 0;
  const contributors = input.contributorCount ?? 0;
  const signals = input.signalCount ?? 0;

  let ease = 30;
  if (input.sensorLive) ease += 35;
  else if (input.sensorGated === false) ease += 20;
  else if (input.proofConnectorId) ease += 15;

  if (maintainers >= 8) ease += 20;
  else if (maintainers >= 3) ease += 12;
  else if (maintainers >= 1) ease += 5;

  if (contributors >= 5) ease += 10;
  if (signals >= 10) ease += 8;

  const value = clamp(ease);
  const difficultyLabel =
    value >= 70 ? "Low" : value >= 45 ? "Medium" : "High";

  const parts: string[] = [];
  if (maintainers > 0) parts.push(`${maintainers} maintainers`);
  if (input.sensorLive) parts.push("sensor live");
  else if (input.sensorGated) parts.push("sensor gated");
  else if (signals > 0) parts.push(`${signals} signals`);

  return {
    dimension: "difficulty",
    label: DIMENSION_LABELS.difficulty,
    value,
    display: difficultyLabel,
    provenance: input.sensorLive ? "sensor" : signals > 0 ? "program" : "heuristic",
    source: parts.length ? parts.join(" · ") : "Catalog — maturity grows as activity syncs",
  };
}

function scoreUrgency(input: OpportunityScoreInput): OpportunityScoreChip {
  const gap = input.fundingGapUsd ?? input.amountNeededUsd;
  const pending = input.pendingFundingUsd ?? 0;
  const ageDays = daysSince(input.updatedAt);

  let value = 20;
  if (pending > 0) value += 25;
  if (gap > 0) value += Math.min(30, (Math.log10(gap + 1) / Math.log10(5000 + 1)) * 30);
  if (ageDays != null) {
    if (ageDays >= 14) value += 25;
    else if (ageDays >= 7) value += 18;
    else if (ageDays >= 2) value += 10;
  }
  if (input.proofAuthorizationId && pending > 0) value += 10;

  value = clamp(value);
  const urgencyLabel = value >= 70 ? "High" : value >= 45 ? "Medium" : "Low";

  const sourceParts: string[] = [];
  if (pending > 0) sourceParts.push(`${formatUsd(pending)} pending`);
  if (gap > 0) sourceParts.push(`${formatUsd(gap)} gap`);
  if (ageDays != null) sourceParts.push(`${Math.round(ageDays)}d since signal`);

  return {
    dimension: "urgency",
    label: DIMENSION_LABELS.urgency,
    value,
    display: urgencyLabel,
    provenance: input.proofAuthorizationId ? "ledger" : gap > 0 ? "estimate" : "heuristic",
    source: sourceParts.join(" · ") || "No pending queue yet",
  };
}

function scoreConfidence(input: OpportunityScoreInput): OpportunityScoreChip {
  let value: number;
  let provenance: ScoreProvenance;
  let source: string;

  if (input.amountVerified && input.proofAuthorizationId) {
    value = 95;
    provenance = "ledger";
    source = `Auth ${input.proofAuthorizationId.slice(0, 8)}…`;
  } else if (input.amountVerified && input.dataSource === "supabase_ledger") {
    value = 88;
    provenance = "program";
    source = "Program metrics on ledger";
  } else if (input.amountVerified) {
    value = 80;
    provenance = "ledger";
    source = "Verified connector event";
  } else if (input.dataSource === "github" && input.amountKind === "estimate") {
    value = 42;
    provenance = "estimate";
    source = "GitHub scan — not ledger-settled";
  } else if (input.dataSource === "community_catalog") {
    value = 18;
    provenance = "heuristic";
    source = "Catalog only — no live sensor";
  } else {
    value = 30;
    provenance = "estimate";
    source = "Modeled estimate";
  }

  const display =
    value >= 85 ? "Verified" : value >= 55 ? "Partial" : value >= 35 ? "Estimate" : "Preview";

  return {
    dimension: "confidence",
    label: DIMENSION_LABELS.confidence,
    value: clamp(value),
    display,
    provenance,
    source,
  };
}

function scoreTime(input: OpportunityScoreInput): OpportunityScoreChip {
  const templateId = input.templateId ?? "docs-bounty";
  const settlementDays = SETTLEMENT_DAYS[templateId] ?? 14;
  const rate = input.settlementRate ?? 0;

  let value = clamp(100 - settlementDays * 2.5);
  if (rate >= 0.8) value = clamp(value + 15);
  else if (rate >= 0.5) value = clamp(value + 8);

  const display = `~${settlementDays}d`;

  return {
    dimension: "time",
    label: DIMENSION_LABELS.time,
    value,
    display,
    provenance: rate > 0 ? "program" : "heuristic",
    source:
      rate > 0
        ? `${Math.round(rate * 100)}% settled · ${templateId.replace(/-/g, " ")}`
        : `Typical Arc batch window · ${templateId.replace(/-/g, " ")}`,
  };
}

function scoreImpact(input: OpportunityScoreInput): OpportunityScoreChip {
  const contributors = input.contributorCount ?? input.peopleImpacted ?? 0;
  const programs = input.programCount ?? (input.templateId ? 1 : 0);
  const signals = input.signalCount ?? 0;
  const yieldMul = input.yieldMultiplier ?? 0;

  let value = 15;
  value += Math.min(25, contributors * 4);
  value += Math.min(20, programs * 10);
  value += Math.min(20, signals * 2);
  if (yieldMul >= 2) value += 15;
  else if (yieldMul >= 1) value += 8;

  const domainBoost: Record<string, number> = {
    oss: 8,
    music: 6,
    research: 7,
    dao: 10,
    community: 5,
  };
  value += domainBoost[input.domain ?? ""] ?? 0;

  value = clamp(value);
  const impactLabel = value >= 70 ? "High" : value >= 45 ? "Medium" : "Emerging";

  const parts: string[] = [];
  if (programs > 0) parts.push(`${programs} program${programs === 1 ? "" : "s"}`);
  if (contributors > 0) parts.push(`${contributors} contributors`);
  if (input.domain) parts.push(input.domain);

  return {
    dimension: "impact",
    label: DIMENSION_LABELS.impact,
    value,
    display: impactLabel,
    provenance: signals > 0 || contributors > 0 ? "program" : "heuristic",
    source: parts.join(" · ") || "Connect programs for impact proof",
  };
}

const WEIGHTS: Record<OpportunityScoreDimension, number> = {
  reward: 0.22,
  urgency: 0.18,
  confidence: 0.2,
  difficulty: 0.12,
  impact: 0.18,
  time: 0.1,
};

/** Investor-grade comparable score — six dimensions with honest provenance. */
export function buildOpportunityScorecard(input: OpportunityScoreInput): OpportunityScorecard {
  const chips = [
    scoreReward(input),
    scoreDifficulty(input),
    scoreUrgency(input),
    scoreConfidence(input),
    scoreTime(input),
    scoreImpact(input),
  ];

  const composite = clamp(
    chips.reduce((sum, c) => sum + c.value * WEIGHTS[c.dimension], 0),
  );

  return { composite, chips };
}

export function scorecardFromTrendingGap(gap: import("@/lib/discover/types").TrendingValueGap): OpportunityScorecard {
  return buildOpportunityScorecard({
    amountNeededUsd: gap.amountNeededUsd,
    moneyCanMoveUsd: gap.moneyCanMoveUsd,
    amountVerified: gap.amountVerified,
    amountKind: gap.amountKind,
    dataSource: gap.dataSource,
    peopleImpacted: gap.peopleImpacted,
    updatedAt: gap.updatedAt,
    proofAuthorizationId: gap.proofAuthorizationId,
    proofConnectorId: gap.proofConnectorId,
    templateId: gap.templateId,
    domain: gap.domain,
    fundingGapUsd: gap.amountNeededUsd,
    pendingFundingUsd: gap.amountVerified ? gap.amountNeededUsd : 0,
    maintainerCount: gap.peopleImpacted,
  });
}

export function scorecardFromFundable(
  o: import("@/lib/capital/community-yield").FundableOpportunity,
): OpportunityScorecard {
  return buildOpportunityScorecard({
    amountNeededUsd: o.fundingGapUsd,
    moneyCanMoveUsd: o.impactValueUsd,
    amountVerified: true,
    dataSource: "supabase_ledger",
    contributorCount: o.contributorCount,
    signalCount: o.signalCount,
    settlementRate: o.settlementRate,
    fundingGapUsd: o.fundingGapUsd,
    templateId: o.templateId,
    domain: o.templateId === "quadratic-funding" ? "dao" : "community",
    yieldMultiplier: o.yieldMultiplier,
    programCount: 1,
    sensorLive: o.signalCount > 0,
  });
}

export type OpportunitySortKey =
  | "composite"
  | "reward"
  | "urgency"
  | "confidence"
  | "impact"
  | "difficulty";

export function sortByOpportunityScore<T extends { opportunityScorecard?: OpportunityScorecard }>(
  items: T[],
  key: OpportunitySortKey = "composite",
): T[] {
  return [...items].sort((a, b) => {
    const cardA = a.opportunityScorecard;
    const cardB = b.opportunityScorecard;
    if (!cardA && !cardB) return 0;
    if (!cardA) return 1;
    if (!cardB) return -1;

    if (key === "composite") return cardB.composite - cardA.composite;

    const chip = (card: OpportunityScorecard, dim: OpportunityScoreDimension) =>
      card.chips.find((c) => c.dimension === dim)?.value ?? 0;

    const dimMap: Record<Exclude<OpportunitySortKey, "composite">, OpportunityScoreDimension> = {
      reward: "reward",
      urgency: "urgency",
      confidence: "confidence",
      impact: "impact",
      difficulty: "difficulty",
    };

    return chip(cardB, dimMap[key]) - chip(cardA, dimMap[key]);
  });
}

export function attachScorecardToGap(
  gap: import("@/lib/discover/types").TrendingValueGap,
): import("@/lib/discover/types").TrendingValueGap {
  const opportunityScorecard = scorecardFromTrendingGap(gap);
  return {
    ...gap,
    opportunityScorecard,
    trendScore: opportunityScorecard.composite * 100 + gap.amountNeededUsd * 0.01,
  };
}
