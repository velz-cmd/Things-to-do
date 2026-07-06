import { describe, expect, it } from "vitest";
import {
  formatDecisionUsd,
  gapsToMissionDecisions,
} from "../../src/lib/mission/mission-recommended-decisions";
import type { TrendingValueGap } from "../../src/lib/discover/types";

function gap(partial: Partial<TrendingValueGap> & Pick<TrendingValueGap, "id" | "headline">): TrendingValueGap {
  return {
    domain: "oss",
    why: "Test gap",
    whoBenefits: "maintainers",
    proofSource: "test",
    dataSource: "local_seed",
    amountVerified: false,
    amountNeededUsd: 400,
    moneyCanMoveUsd: 0,
    peopleImpacted: 3,
    trendScore: 500,
    updatedAt: new Date().toISOString(),
    actions: [],
    ...partial,
  };
}

describe("gapsToMissionDecisions", () => {
  it("returns fallback decisions when feed is empty", () => {
    const decisions = gapsToMissionDecisions([], 2);
    expect(decisions).toHaveLength(2);
    expect(decisions[0]?.title).toBe("React Docs");
  });

  it("maps verified gaps to Authorize CTA", () => {
    const decisions = gapsToMissionDecisions([
      gap({
        id: "a1",
        headline: "Alice — payment pending",
        amountVerified: true,
        moneyCanMoveUsd: 42,
        trendScore: 800,
      }),
    ]);
    expect(decisions[0]?.cta).toBe("Authorize");
    expect(decisions[0]?.prompt).toMatch(/Authorize settlement/i);
  });

  it("sorts by trend score descending", () => {
    const decisions = gapsToMissionDecisions([
      gap({ id: "low", headline: "Low", trendScore: 100 }),
      gap({ id: "high", headline: "High", trendScore: 900 }),
    ]);
    expect(decisions[0]?.title).toBe("High");
  });
});

describe("formatDecisionUsd", () => {
  it("formats thousands compactly", () => {
    expect(formatDecisionUsd(1200)).toBe("$1.2k");
    expect(formatDecisionUsd(500)).toBe("$500");
  });
});
