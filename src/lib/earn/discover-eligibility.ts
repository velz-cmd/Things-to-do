/**
 * Discover + profile eligibility — fixed blocks, not log-scaled marketing numbers.
 * Music: 500 plays → $10 · Video/research: 1,000 views → $10 · OSS: 5 merges → $10
 */

export const COHORT_POOL_SIZE = 10;

export const MUSIC_MIN_PLAYS = 500;
export const MUSIC_PAYOUT_USD = 10;

export const VIDEO_MIN_VIEWS = 1_000;
export const VIDEO_PAYOUT_USD = 10;

/** Research uses attributed views (Jellyfin/OpenAlex exposure) — 1,000 views → $10 */
export const RESEARCH_MIN_VIEWS = 1_000;
export const RESEARCH_PAYOUT_USD = 10;

export const OSS_MIN_MERGES = 5;
export const OSS_MIN_STARS = 100;
export const OSS_PAYOUT_USD = 10;

export function payoutUsdFromBlocks(
  count: number,
  minPerBlock: number,
  usdPerBlock: number,
  capUsd = 50_000,
): number {
  if (count < minPerBlock) return 0;
  const blocks = Math.floor(count / minPerBlock);
  return Math.min(blocks * usdPerBlock, capUsd);
}

export function meetsMusicEligibility(playCount: number): boolean {
  return playCount >= MUSIC_MIN_PLAYS;
}

export function meetsVideoEligibility(viewCount: number): boolean {
  return viewCount >= VIDEO_MIN_VIEWS;
}

export function meetsResearchEligibility(viewCount: number): boolean {
  return viewCount >= RESEARCH_MIN_VIEWS;
}

export function meetsOssEligibility(mergedPrCount: number, stars: number): boolean {
  return mergedPrCount >= OSS_MIN_MERGES || stars >= OSS_MIN_STARS;
}

export function batchIntoCohorts<T>(items: T[], size = COHORT_POOL_SIZE): T[][] {
  const cohorts: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    cohorts.push(items.slice(i, i + size));
  }
  return cohorts;
}
