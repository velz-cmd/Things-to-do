/**
 * YouTube-style eligibility + capped USD estimates per community type.
 * Estimates are never presented as ledger-verified amounts.
 */

export type ValuationResult = {
  usd: number;
  eligibility: string;
  tier: "minimum" | "growing" | "established";
};

const OSS_CAP_USD = 25_000;
const MUSIC_CAP_USD = 15_000;
const VIDEO_CAP_USD = 12_000;

function clampUsd(value: number, min: number, max: number): number {
  return Math.round(Math.min(max, Math.max(min, value)));
}

/** OSS: merged PRs + adoption unlock minimum; scales logarithmically, capped. */
export function estimateOssFundingGap(input: {
  stars: number;
  forks: number;
  mergedPrCount: number;
  maintainerCount: number;
}): ValuationResult {
  const minMerges = 5;
  const minStars = 100;
  const qualified =
    input.mergedPrCount >= minMerges || input.stars >= minStars;

  const mergeValue = Math.min(input.mergedPrCount, 150) * 6;
  const adoption =
    Math.log10(input.stars + 1) * 95 + Math.log10(input.forks + 1) * 35;
  const maintainerStress =
    input.maintainerCount <= 1 && input.stars > 500 ? adoption * 0.25 : 0;

  const raw = (qualified ? 75 : 35) + mergeValue + adoption + maintainerStress;
  const usd = clampUsd(raw, qualified ? 75 : 25, OSS_CAP_USD);

  const tier: ValuationResult["tier"] =
    usd >= 8_000 ? "established" : usd >= 1_500 ? "growing" : "minimum";

  const eligibility = qualified
    ? `${minMerges}+ merged PRs or ${minStars}+ stars · value scales with contributions & adoption`
    : `Below threshold — need ${minMerges}+ merges or ${minStars}+ stars for full estimate`;

  return { usd, eligibility, tier };
}

/** Music / ListenBrainz: plays unlock minimum; scales with listen proof. */
export function estimateMusicValueUsd(input: {
  playCount: number;
  uniqueListeners?: number;
  artistCount?: number;
}): ValuationResult {
  const minPlays = 1_000;
  const qualified = input.playCount >= minPlays;
  const playValue = Math.log10(input.playCount + 1) * 180;
  const listenerBoost = Math.log10((input.uniqueListeners ?? 1) + 1) * 60;
  const raw = (qualified ? 50 : 20) + playValue + listenerBoost;
  const usd = clampUsd(raw, qualified ? 50 : 15, MUSIC_CAP_USD);
  const tier: ValuationResult["tier"] =
    usd >= 5_000 ? "established" : usd >= 800 ? "growing" : "minimum";
  const eligibility = `${minPlays.toLocaleString()}+ plays unlock minimum · scales with listens & attribution`;
  return { usd, eligibility, tier };
}

/** Jellyfin / video: views unlock minimum; scales with watch proof. */
export function estimateVideoValueUsd(input: {
  viewCount: number;
  uniqueViewers?: number;
}): ValuationResult {
  const minViews = 500;
  const qualified = input.viewCount >= minViews;
  const viewValue = Math.log10(input.viewCount + 1) * 150;
  const viewerBoost = Math.log10((input.uniqueViewers ?? 1) + 1) * 45;
  const raw = (qualified ? 40 : 18) + viewValue + viewerBoost;
  const usd = clampUsd(raw, qualified ? 40 : 12, VIDEO_CAP_USD);
  const tier: ValuationResult["tier"] =
    usd >= 4_000 ? "established" : usd >= 600 ? "growing" : "minimum";
  const eligibility = `${minViews}+ verified views unlock minimum · scales with watch time`;
  return { usd, eligibility, tier };
}

/** Research: citations unlock minimum. */
export function estimateResearchValueUsd(input: {
  citationCount: number;
  workCount?: number;
}): ValuationResult {
  const minCitations = 10;
  const qualified = input.citationCount >= minCitations;
  const citeValue = Math.log10(input.citationCount + 1) * 120;
  const workBoost = Math.min((input.workCount ?? 1) * 8, 200);
  const raw = (qualified ? 60 : 25) + citeValue + workBoost;
  const usd = clampUsd(raw, qualified ? 60 : 20, 10_000);
  const tier: ValuationResult["tier"] =
    usd >= 3_000 ? "established" : usd >= 500 ? "growing" : "minimum";
  const eligibility = `${minCitations}+ citations unlock minimum · scales with attributed works`;
  return { usd, eligibility, tier };
}
