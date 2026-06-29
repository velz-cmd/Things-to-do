/** Community Yield — verified impact multiplier for funders (target 2× by default). */

export const DEFAULT_TARGET_YIELD_MULTIPLIER = 2;

export type ProgramImpactInput = {
  settledUsd: number;
  claimableUsd: number;
  authorizedUsd: number;
  contributorCount: number;
};

export type ProgramYieldSnapshot = {
  programId: string;
  missionId: string | null;
  impactValueUsd: number;
  principalFundedUsd: number;
  yieldMultiplier: number;
  targetMultiplier: number;
  targetMet: boolean;
  fundingGapUsd: number;
  breakdown: {
    fromSettled: number;
    fromClaimable: number;
    fromAuthorized: number;
    fromContributors: number;
  };
};

export type FunderStakeYield = {
  stakeId: string;
  programId: string;
  programName: string;
  communitySlug: string;
  communityName: string;
  principalUsd: number;
  releasedUsd: number;
  attributedImpactUsd: number;
  yieldMultiplier: number;
  targetMultiplier: number;
  targetMet: boolean;
  status: string;
  fundedAt: string;
};

export type FundableOpportunity = {
  programId: string;
  programName: string;
  communitySlug: string;
  communityName: string;
  communityTagline: string;
  templateId: string;
  templateLabel: string;
  status: string;
  budgetUsd: number;
  principalFundedUsd: number;
  fundingGapUsd: number;
  impactValueUsd: number;
  projectedYieldAt2x: number;
  yieldMultiplier: number;
  targetMultiplier: number;
  settlementRate: number;
  contributorCount: number;
  signalCount: number;
  whyFund: string;
  whoBenefits: string;
  score: number;
};

/** Verified economic value created in a program (not speculative ROI). */
export function computeProgramImpactValue(input: ProgramImpactInput): {
  total: number;
  breakdown: ProgramYieldSnapshot["breakdown"];
} {
  const fromSettled = input.settledUsd;
  const fromClaimable = input.claimableUsd * 0.9;
  const fromAuthorized = input.authorizedUsd * 0.5;
  const fromContributors = Math.min(input.contributorCount * 2, 50);

  const total = Math.round(
    (fromSettled + fromClaimable + fromAuthorized + fromContributors) * 100,
  ) / 100;

  return {
    total,
    breakdown: {
      fromSettled: Math.round(fromSettled * 100) / 100,
      fromClaimable: Math.round(fromClaimable * 100) / 100,
      fromAuthorized: Math.round(fromAuthorized * 100) / 100,
      fromContributors: Math.round(fromContributors * 100) / 100,
    },
  };
}

export function computeYieldMultiplier(
  impactValueUsd: number,
  principalFundedUsd: number,
): number {
  if (principalFundedUsd < 0.01) return 0;
  return Math.round((impactValueUsd / principalFundedUsd) * 100) / 100;
}

export function fundingGapForTarget(
  impactValueUsd: number,
  principalFundedUsd: number,
  targetMultiplier = DEFAULT_TARGET_YIELD_MULTIPLIER,
): number {
  const requiredPrincipal = impactValueUsd / targetMultiplier;
  return Math.max(0, Math.round((requiredPrincipal - principalFundedUsd) * 100) / 100);
}

export function templateLabel(templateId: string): string {
  const map: Record<string, string> = {
    "user-centric-royalties": "Music royalties",
    "video-royalties": "Video royalties",
    "docs-bounty": "Documentation bounties",
    "security-fund": "Security fund",
    "citation-toll": "Research citations",
    "quadratic-funding": "Matched funding round",
  };
  return map[templateId] ?? templateId.replace(/-/g, " ");
}

export function whyFundCopy(input: {
  templateId: string;
  communityName: string;
  fundingGapUsd: number;
  settlementRate: number;
}): { whyFund: string; whoBenefits: string } {
  const tpl = templateLabel(input.templateId);
  const gap =
    input.fundingGapUsd > 0 ?
      `$${input.fundingGapUsd.toFixed(0)} more unlocks verified payouts at 2× impact.`
    : "Program is creating verified value — add capital to accelerate payouts.";

  const whoBenefits =
    input.templateId.includes("royalt") || input.templateId.includes("music") ?
      "Artists and credits — listeners stay on their normal apps."
    : input.templateId === "docs-bounty" || input.templateId === "security-fund" ?
      "Maintainers and contributors on GitHub — no migration required."
    : input.templateId === "citation-toll" ?
      "Researchers and authors — readers don't need RESOLVE."
    : input.templateId === "video-royalties" ?
      "Creators and hosts — viewers keep using Jellyfin."
    : `Creators in ${input.communityName} — upstream communities unchanged.`;

  return {
    whyFund: `${tpl} in ${input.communityName}. ${gap}`,
    whoBenefits,
  };
}

export function opportunityScore(input: {
  fundingGapUsd: number;
  settlementRate: number;
  signalCount: number;
  yieldMultiplier: number;
  targetMultiplier: number;
}): number {
  let score = 0;
  score += Math.min(input.fundingGapUsd / 10, 40);
  score += input.settlementRate * 25;
  score += Math.min(input.signalCount, 20);
  if (input.yieldMultiplier >= input.targetMultiplier) score += 15;
  return Math.round(score);
}
