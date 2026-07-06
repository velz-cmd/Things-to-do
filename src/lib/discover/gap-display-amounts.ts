import type { TrendingValueGap } from "@/lib/discover/types";
import type { ProgramPoolState } from "@/lib/capital/pool-checkpoint-types";

const PREVIEW_AMOUNT_USD: Record<string, number> = {
  react: 2430,
  linux: 5120,
  navidrome: 183,
  "independent-music": 183,
  jellyfin: 721,
  "open-research": 3120,
};

function previewAmountUsdForCommunity(slug: string): number {
  return PREVIEW_AMOUNT_USD[slug] ?? 0;
}

/** Catalog / sensor estimate before a program pool exists on ledger. */
export function catalogEstimateUsdForGap(gap: TrendingValueGap): number {
  const fromGap = Math.max(gap.amountNeededUsd ?? 0, gap.moneyCanMoveUsd ?? 0);
  if (fromGap > 0) return fromGap;
  if (gap.communitySlug) {
    const preview = previewAmountUsdForCommunity(gap.communitySlug);
    if (preview > 0) return preview;
  }
  return 0;
}

export function enrichGapCatalogAmounts(gap: TrendingValueGap): TrendingValueGap {
  const catalog = catalogEstimateUsdForGap(gap);
  const owed = Math.max(gap.amountNeededUsd ?? 0, gap.moneyCanMoveUsd ?? 0);
  if (owed > 0) return gap;
  if (catalog <= 0) return gap;
  return {
    ...gap,
    amountNeededUsd: catalog,
    moneyCanMoveUsd: catalog,
    amountKind: gap.amountKind ?? "estimate",
  };
}

export type GapDisplayAmounts = {
  catalogEstimateUsd: number;
  ledgerOwedUsd: number;
  displayOwedUsd: number;
  displayPoolUsd: number;
  displayHeroUsd: number;
  yourDepositUsd: number;
  contributorCount: number;
  isEstimate: boolean;
};

export function resolveGapDisplayAmounts(input: {
  gap: TrendingValueGap;
  pool: ProgramPoolState | null;
  fundedUsdForProgram: number;
  fundedUsdForCommunity?: number;
  yourDepositFromPool: number;
}): GapDisplayAmounts {
  const catalogEstimateUsd = catalogEstimateUsdForGap(input.gap);
  const ledgerOwedUsd = Math.max(input.pool?.owedToCreatorsUsd ?? 0, 0);
  const displayOwedUsd = ledgerOwedUsd > 0 ? ledgerOwedUsd : catalogEstimateUsd;
  const communityFunded = input.fundedUsdForCommunity ?? 0;
  const displayPoolUsd = Math.max(
    input.pool?.poolBalanceUsd ?? 0,
    input.fundedUsdForProgram,
    communityFunded,
  );
  const displayHeroUsd = displayPoolUsd > 0 ? displayPoolUsd : displayOwedUsd;
  const yourDepositUsd = Math.max(
    input.yourDepositFromPool,
    input.fundedUsdForProgram,
    communityFunded,
  );
  const contributorCount =
    input.pool?.contributorCount ??
    input.gap.peopleImpacted ??
    input.gap.valueMetrics?.countValue ??
    0;
  const isEstimate =
    !input.gap.amountVerified &&
    ledgerOwedUsd <= 0 &&
    catalogEstimateUsd > 0 &&
    input.gap.dataSource !== "supabase_ledger";

  return {
    catalogEstimateUsd,
    ledgerOwedUsd,
    displayOwedUsd,
    displayPoolUsd,
    displayHeroUsd,
    yourDepositUsd,
    contributorCount,
    isEstimate,
  };
}
