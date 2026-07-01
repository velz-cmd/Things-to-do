/** Program fulfillment metrics — doctrine-aligned, not speculative ROI. */

import {
  computeMatchLeverage,
  DEFAULT_MATCH_LEVERAGE_TARGET,
} from "@/lib/capital/quadratic-funding";

export const DEFAULT_TARGET_YIELD_MULTIPLIER = DEFAULT_MATCH_LEVERAGE_TARGET;

export type ProgramImpactInput = {
  settledUsd: number;
  claimableUsd: number;
  authorizedUsd: number;
  contributorCount: number;
  templateId?: string;
  communityContributionsUsd?: number;
  matchDistributedUsd?: number;
};

export type ProgramYieldSnapshot = {
  programId: string;
  missionId: string | null;
  templateId: string;
  /** Verified value cleared or unlocked by program capital */
  impactValueUsd: number;
  principalFundedUsd: number;
  yieldMultiplier: number;
  targetMultiplier: number;
  targetMet: boolean;
  fundingGapUsd: number;
  metricKind: "fulfillment" | "match_leverage";
  breakdown: {
    fromSettled: number;
    fromClaimable: number;
    fromAuthorized: number;
    fromContributors: number;
    fromCommunityContributions?: number;
    fromMatchDistributed?: number;
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
  metricKind: "fulfillment" | "match_leverage";
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
  metricKind: "fulfillment" | "match_leverage";
  needType?: import("@/lib/discover/need-types").DiscoverNeedType;
  opportunityScorecard?: import("@/lib/discover/opportunity-score").OpportunityScorecard;
};

/** Verified economic value — fulfillment ratio for standard programs, match leverage for QF. */
export function computeProgramImpactValue(input: ProgramImpactInput): {
  total: number;
  metricKind: "fulfillment" | "match_leverage";
  breakdown: ProgramYieldSnapshot["breakdown"];
} {
  if (input.templateId === "quadratic-funding") {
    const communityContributionsUsd = input.communityContributionsUsd ?? 0;
    const matchDistributedUsd = input.matchDistributedUsd ?? input.settledUsd;
    const total = communityContributionsUsd + matchDistributedUsd;
    return {
      total: Math.round(total * 100) / 100,
      metricKind: "match_leverage",
      breakdown: {
        fromSettled: 0,
        fromClaimable: 0,
        fromAuthorized: 0,
        fromContributors: input.contributorCount,
        fromCommunityContributions: Math.round(communityContributionsUsd * 100) / 100,
        fromMatchDistributed: Math.round(matchDistributedUsd * 100) / 100,
      },
    };
  }

  const fromSettled = input.settledUsd;
  const fromClaimable = input.claimableUsd;
  const fromAuthorized = input.authorizedUsd * 0.5;
  const fromContributors = Math.min(input.contributorCount * 2, 50);

  const total = Math.round(
    (fromSettled + fromClaimable + fromAuthorized + fromContributors) * 100,
  ) / 100;

  return {
    total,
    metricKind: "fulfillment",
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
    "quadratic-funding": "Quadratic funding",
  };
  return map[templateId] ?? templateId.replace(/-/g, " ");
}

export function whyFundCopy(input: {
  templateId: string;
  communityName: string;
  fundingGapUsd: number;
  settlementRate: number;
  pendingFundingUsd?: number;
}): { whyFund: string; whoBenefits: string } {
  if (input.templateId === "quadratic-funding") {
    const gap =
      input.fundingGapUsd > 0 ?
        `$${input.fundingGapUsd.toFixed(0)} more in the match pool reaches 2× community leverage.`
      : "Community is contributing on Open Collective — add match pool to amplify with QF.";

    return {
      whyFund:
        `Quadratic funding round for ${input.communityName}. ${gap} Funders fulfill the match pool; small donors get amplified.`,
      whoBenefits:
        "Hosted projects and maintainers on Open Collective — contributors keep using OC as normal.",
    };
  }

  const tpl = templateLabel(input.templateId);
  const pending =
    (input.pendingFundingUsd ?? 0) > 0 ?
      `$${input.pendingFundingUsd!.toFixed(0)} already authorized, waiting for fulfillment.`
    : input.fundingGapUsd > 0 ?
      `$${input.fundingGapUsd.toFixed(0)} more clears owed authorizations at 2× fulfillment.`
    : "Authorizations are building — fund to clear the queue.";

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
    whyFund: `${tpl} in ${input.communityName}. ${pending}`,
    whoBenefits,
  };
}

export function opportunityScore(input: {
  fundingGapUsd: number;
  settlementRate: number;
  signalCount: number;
  yieldMultiplier: number;
  targetMultiplier: number;
  pendingFundingUsd?: number;
}): number {
  let score = 0;
  score += Math.min((input.pendingFundingUsd ?? input.fundingGapUsd) / 10, 40);
  score += input.settlementRate * 25;
  score += Math.min(input.signalCount, 20);
  if (input.yieldMultiplier >= input.targetMultiplier) score += 15;
  return Math.round(score);
}

export { computeMatchLeverage };
