import { describe, expect, it } from "vitest";
import {
  catalogEstimateUsdForGap,
  enrichGapCatalogAmounts,
  resolveGapDisplayAmounts,
} from "../../src/lib/discover/gap-display-amounts";
import type { TrendingValueGap } from "../../src/lib/discover/types";

const previewGap = (overrides: Partial<TrendingValueGap> = {}): TrendingValueGap => ({
  id: "value-preview-gaps-react",
  domain: "oss",
  headline: "React documentation work is verified but unpaid.",
  why: "",
  whoBenefits: "",
  proofSource: "GitHub",
  dataSource: "community_catalog",
  amountVerified: false,
  amountNeededUsd: 0,
  moneyCanMoveUsd: 0,
  peopleImpacted: 0,
  trendScore: 0,
  communitySlug: "react",
  templateId: "docs-bounty",
  actions: [],
  ...overrides,
});

describe("gap-display-amounts", () => {
  it("backfills catalog estimate when gap amounts are zero", () => {
    const enriched = enrichGapCatalogAmounts(previewGap());
    expect(enriched.amountNeededUsd).toBe(2430);
    expect(enriched.moneyCanMoveUsd).toBe(2430);
  });

  it("prefers ledger owed over catalog estimate", () => {
    const amounts = resolveGapDisplayAmounts({
      gap: previewGap({ amountNeededUsd: 2430, moneyCanMoveUsd: 2430 }),
      pool: {
        owedToCreatorsUsd: 120,
        poolBalanceUsd: 10,
        funder: { yourDepositUsd: 10 },
      } as never,
      fundedUsdForProgram: 10,
      yourDepositFromPool: 10,
    });
    expect(amounts.displayOwedUsd).toBe(120);
    expect(amounts.displayPoolUsd).toBe(10);
    expect(amounts.displayHeroUsd).toBe(10);
  });

  it("shows catalog estimate when pool has no ledger owed", () => {
    const amounts = resolveGapDisplayAmounts({
      gap: enrichGapCatalogAmounts(previewGap()),
      pool: { owedToCreatorsUsd: 0, poolBalanceUsd: 0, funder: { yourDepositUsd: 0 } } as never,
      fundedUsdForProgram: 0,
      yourDepositFromPool: 0,
    });
    expect(amounts.displayOwedUsd).toBe(2430);
    expect(amounts.isEstimate).toBe(true);
  });

  it("reads catalog estimate from community slug", () => {
    expect(catalogEstimateUsdForGap(previewGap())).toBe(2430);
  });
});
