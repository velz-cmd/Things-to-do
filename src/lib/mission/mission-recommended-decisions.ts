import type { TrendingValueGap } from "@/lib/discover/types";

export type MissionDecision = {
  id: string;
  title: string;
  subtitle: string;
  neededUsd: number;
  confidence: number;
  stars: number;
  impact: "High" | "Medium" | "Critical";
  cta: "Authorize" | "Open Blueprint" | "Review";
  prompt: string;
  domain: TrendingValueGap["domain"];
};

const FALLBACK_DECISIONS: MissionDecision[] = [
  {
    id: "fallback-react-docs",
    title: "React Docs",
    subtitle: "Documentation backlog growing — maintainer capacity gap",
    neededUsd: 500,
    confidence: 88,
    stars: 5,
    impact: "High",
    cta: "Open Blueprint",
    prompt: "Create a Capital Blueprint for React documentation — $500 program for docs contributors.",
    domain: "oss",
  },
  {
    id: "fallback-navidrome",
    title: "Navidrome",
    subtitle: "Royalty pool needs policy before artist retention drops",
    neededUsd: 250,
    confidence: 92,
    stars: 5,
    impact: "High",
    cta: "Open Blueprint",
    prompt: "Design a royalty pool blueprint for Navidrome — $250 minimum, show payee cohort.",
    domain: "music",
  },
  {
    id: "fallback-linux-security",
    title: "Linux Security",
    subtitle: "Unpaid maintainer work on critical CVE response",
    neededUsd: 1200,
    confidence: 79,
    stars: 4,
    impact: "Critical",
    cta: "Review",
    prompt: "Research the Linux kernel security funding gap — who is unpaid and what evidence exists?",
    domain: "oss",
  },
];

function starsFromTrendScore(score: number): number {
  if (score >= 900) return 5;
  if (score >= 600) return 4;
  if (score >= 350) return 3;
  if (score >= 150) return 2;
  return 1;
}

function impactFromGap(gap: TrendingValueGap): MissionDecision["impact"] {
  if (gap.amountNeededUsd >= 1000 || gap.domain === "protocol") return "Critical";
  if (gap.trendScore >= 500 || gap.amountVerified) return "High";
  return "Medium";
}

function confidenceFromGap(gap: TrendingValueGap): number {
  const base = gap.amountVerified ? 92 : 76;
  const trendBoost = Math.min(8, Math.floor(gap.trendScore / 120));
  return Math.min(99, base + trendBoost);
}

function ctaFromGap(gap: TrendingValueGap): MissionDecision["cta"] {
  if (gap.amountVerified && gap.moneyCanMoveUsd > 0) return "Authorize";
  if (gap.templateId || gap.programId) return "Open Blueprint";
  if (gap.amountNeededUsd >= 800) return "Review";
  return "Open Blueprint";
}

function promptFromGap(gap: TrendingValueGap): string {
  const amount = Math.max(25, Math.round(gap.amountNeededUsd));
  const name = gap.headline.split("—")[0]?.trim() || gap.headline;

  if (ctaFromGap(gap) === "Authorize") {
    return `Authorize settlement for ${name} — ${gap.why}`;
  }
  if (ctaFromGap(gap) === "Review") {
    return `Research funding gap: ${name}. ${gap.why} Show evidence and estimated unpaid work.`;
  }
  return `Create a Capital Blueprint for ${name} — $${amount} program. ${gap.whoBenefits}`;
}

/** Map Discover trending gaps into Mission decision cards (not opportunity tiles). */
export function gapsToMissionDecisions(
  gaps: TrendingValueGap[],
  limit = 3,
): MissionDecision[] {
  const ranked = [...gaps].sort((a, b) => b.trendScore - a.trendScore).slice(0, limit);

  if (ranked.length === 0) {
    return FALLBACK_DECISIONS.slice(0, limit);
  }

  return ranked.map((gap) => ({
    id: gap.id,
    title: gap.headline.split("—")[0]?.trim() || gap.headline,
    subtitle: gap.why,
    neededUsd: gap.amountNeededUsd,
    confidence: confidenceFromGap(gap),
    stars: starsFromTrendScore(gap.trendScore),
    impact: impactFromGap(gap),
    cta: ctaFromGap(gap),
    prompt: promptFromGap(gap),
    domain: gap.domain,
  }));
}

export function formatDecisionUsd(amount: number): string {
  if (amount >= 1000) return `$${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}k`;
  return `$${Math.round(amount)}`;
}
