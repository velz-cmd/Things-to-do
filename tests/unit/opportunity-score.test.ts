import { describe, expect, it } from "vitest";
import {
  attachScorecardToGap,
  buildOpportunityScorecard,
  sortByOpportunityScore,
} from "../../src/lib/discover/opportunity-score";

describe("opportunity score", () => {
  it("caps estimate reward below ledger scores", () => {
    const ledger = buildOpportunityScorecard({
      amountNeededUsd: 500,
      amountVerified: true,
      proofAuthorizationId: "auth123",
      proofConnectorId: "github",
      templateId: "docs-bounty",
      domain: "oss",
    });
    const estimate = buildOpportunityScorecard({
      amountNeededUsd: 20_000,
      amountVerified: false,
      amountKind: "estimate",
      dataSource: "github",
      templateId: "docs-bounty",
      domain: "oss",
      maintainerCount: 12,
    });

    const ledgerReward = ledger.chips.find((c) => c.dimension === "reward")!;
    const estimateReward = estimate.chips.find((c) => c.dimension === "reward")!;

    expect(ledgerReward.provenance).toBe("ledger");
    expect(estimateReward.provenance).toBe("estimate");
    expect(estimateReward.value).toBeLessThanOrEqual(72);
    expect(ledger.confidence).toBeUndefined();
    expect(ledger.chips.find((c) => c.dimension === "confidence")!.display).toBe("Verified");
    expect(estimate.chips.find((c) => c.dimension === "confidence")!.display).toBe("Estimate");
  });

  it("returns six score chips with provenance", () => {
    const card = buildOpportunityScorecard({
      amountNeededUsd: 250,
      amountVerified: true,
      contributorCount: 5,
      signalCount: 12,
      settlementRate: 0.6,
      templateId: "quadratic-funding",
      domain: "dao",
      updatedAt: new Date(Date.now() - 10 * 86_400_000).toISOString(),
    });
    expect(card.chips).toHaveLength(6);
    expect(card.composite).toBeGreaterThan(0);
    expect(card.chips.every((c) => c.source.length > 0)).toBe(true);
  });

  it("sorts gaps by composite score", () => {
    const low = attachScorecardToGap({
      id: "a",
      domain: "community",
      headline: "Low",
      why: "",
      whoBenefits: "",
      proofSource: "",
      dataSource: "community_catalog",
      amountVerified: false,
      amountNeededUsd: 10,
      moneyCanMoveUsd: 0,
      peopleImpacted: 0,
      trendScore: 0,
      actions: [],
    });
    const high = attachScorecardToGap({
      id: "b",
      domain: "oss",
      headline: "High",
      why: "",
      whoBenefits: "",
      proofSource: "",
      dataSource: "supabase_ledger",
      amountVerified: true,
      proofAuthorizationId: "x",
      amountNeededUsd: 500,
      moneyCanMoveUsd: 500,
      peopleImpacted: 3,
      trendScore: 0,
      templateId: "docs-bounty",
      actions: [],
    });
    const sorted = sortByOpportunityScore([low, high]);
    expect(sorted[0].id).toBe("b");
  });
});
