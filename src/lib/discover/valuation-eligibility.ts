/**
 * YouTube-style eligibility + capped USD estimates per community type.
 * Estimates use fixed $10 blocks at published thresholds — not ledger-verified amounts.
 */

import {
  meetsMusicEligibility,
  meetsOssEligibility,
  meetsResearchEligibility,
  meetsVideoEligibility,
  MUSIC_MIN_PLAYS,
  MUSIC_PAYOUT_USD,
  OSS_MIN_MERGES,
  OSS_MIN_STARS,
  OSS_PAYOUT_USD,
  payoutUsdFromBlocks,
  RESEARCH_MIN_VIEWS,
  RESEARCH_PAYOUT_USD,
  VIDEO_MIN_VIEWS,
  VIDEO_PAYOUT_USD,
} from "@/lib/earn/discover-eligibility";

export type ValuationResult = {
  usd: number;
  eligibility: string;
  tier: "minimum" | "growing" | "established";
};

export const OSS_CAP_USD = 25_000;
const MUSIC_CAP_USD = 15_000;
const VIDEO_CAP_USD = 12_000;
const RESEARCH_CAP_USD = 10_000;

function tierFromUsd(usd: number): ValuationResult["tier"] {
  if (usd >= 5_000) return "established";
  if (usd >= 500) return "growing";
  return "minimum";
}

/** OSS: 5+ merges or 100+ stars → $10 per qualifying block. */
export function estimateOssFundingGap(input: {
  stars: number;
  forks: number;
  mergedPrCount: number;
  maintainerCount: number;
}): ValuationResult {
  const qualified = meetsOssEligibility(input.mergedPrCount, input.stars);
  const mergeBlocks = payoutUsdFromBlocks(
    input.mergedPrCount,
    OSS_MIN_MERGES,
    OSS_PAYOUT_USD,
    OSS_CAP_USD,
  );
  const starBlocks = payoutUsdFromBlocks(
    input.stars,
    OSS_MIN_STARS,
    OSS_PAYOUT_USD,
    OSS_CAP_USD,
  );
  const usd = Math.min(Math.max(mergeBlocks, starBlocks), OSS_CAP_USD);
  const eligibility = qualified
    ? `${OSS_MIN_MERGES}+ merged PRs or ${OSS_MIN_STARS}+ stars → $${OSS_PAYOUT_USD} per block · batched in pools of 10`
    : `Below threshold — need ${OSS_MIN_MERGES}+ merges or ${OSS_MIN_STARS}+ stars`;

  return { usd: qualified ? Math.max(usd, OSS_PAYOUT_USD) : usd, eligibility, tier: tierFromUsd(usd) };
}

/** Music: 500+ plays (ListenBrainz + MusicBrainz) → $10 per block. */
export function estimateMusicValueUsd(input: {
  playCount: number;
  uniqueListeners?: number;
  artistCount?: number;
}): ValuationResult {
  const qualified = meetsMusicEligibility(input.playCount);
  const usd = payoutUsdFromBlocks(
    input.playCount,
    MUSIC_MIN_PLAYS,
    MUSIC_PAYOUT_USD,
    MUSIC_CAP_USD,
  );
  const eligibility = `${MUSIC_MIN_PLAYS.toLocaleString()}+ plays → $${MUSIC_PAYOUT_USD} · ListenBrainz + MusicBrainz · pools of 10 artists`;
  return {
    usd: qualified ? Math.max(usd, MUSIC_PAYOUT_USD) : 0,
    eligibility,
    tier: tierFromUsd(usd),
  };
}

/** Jellyfin / video: 1,000+ views → $10 per block. */
export function estimateVideoValueUsd(input: {
  viewCount: number;
  uniqueViewers?: number;
}): ValuationResult {
  const qualified = meetsVideoEligibility(input.viewCount);
  const usd = payoutUsdFromBlocks(
    input.viewCount,
    VIDEO_MIN_VIEWS,
    VIDEO_PAYOUT_USD,
    VIDEO_CAP_USD,
  );
  const eligibility = `${VIDEO_MIN_VIEWS.toLocaleString()}+ verified views → $${VIDEO_PAYOUT_USD}`;
  return {
    usd: qualified ? Math.max(usd, VIDEO_PAYOUT_USD) : 0,
    eligibility,
    tier: tierFromUsd(usd),
  };
}

/** Research: 1,000+ attributed views → $10 per block. */
export function estimateResearchValueUsd(input: {
  citationCount?: number;
  viewCount?: number;
  workCount?: number;
}): ValuationResult {
  const views = input.viewCount ?? input.citationCount ?? 0;
  const qualified = meetsResearchEligibility(views);
  const usd = payoutUsdFromBlocks(
    views,
    RESEARCH_MIN_VIEWS,
    RESEARCH_PAYOUT_USD,
    RESEARCH_CAP_USD,
  );
  const eligibility = `${RESEARCH_MIN_VIEWS.toLocaleString()}+ views → $${RESEARCH_PAYOUT_USD} · researchers batched in pools of 10`;
  return {
    usd: qualified ? Math.max(usd, RESEARCH_PAYOUT_USD) : 0,
    eligibility,
    tier: tierFromUsd(usd),
  };
}
