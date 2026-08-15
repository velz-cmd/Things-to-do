import { describe, expect, it } from "vitest";
import {
  inferPrimaryRole,
  rankForRole,
  scoreForRole,
  type RankableItem,
} from "../../src/lib/discover/impact/role-ranking";

function item(overrides: Partial<RankableItem> & { id: string }): RankableItem {
  return {
    actionable: false,
    hasSourcedImpact: false,
    hasFundingIntent: false,
    uncovered: false,
    needsViewerResolution: false,
    earnable: false,
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("Role-aware Discover ranking", () => {
  it("ranks fundable, evidenced, uncovered work first for a funder", () => {
    const fundable = item({
      id: "fundable",
      actionable: true,
      hasSourcedImpact: true,
      uncovered: true,
    });
    const earnable = item({ id: "earnable", earnable: true, hasFundingIntent: true });
    const ranked = rankForRole([earnable, fundable], "funder");
    expect(ranked[0]?.id).toBe("fundable");
  });

  it("ranks paid, claimable work first for a contributor", () => {
    const fundable = item({
      id: "fundable",
      actionable: true,
      hasSourcedImpact: true,
      uncovered: true,
    });
    const earnable = item({
      id: "earnable",
      earnable: true,
      hasFundingIntent: true,
      actionable: true,
    });
    const ranked = rankForRole([fundable, earnable], "contributor");
    expect(ranked[0]?.id).toBe("earnable");
  });

  it("ranks work blocked on the viewer first for an operator", () => {
    const blocked = item({ id: "blocked", needsViewerResolution: true });
    const fundable = item({
      id: "fundable",
      actionable: true,
      hasSourcedImpact: true,
      uncovered: true,
    });
    const ranked = rankForRole([fundable, blocked], "operator");
    expect(ranked[0]?.id).toBe("blocked");
  });

  it("never drops items - a role guess cannot hide the marketplace", () => {
    const items = [
      item({ id: "a" }),
      item({ id: "b", earnable: true }),
      item({ id: "c", actionable: true }),
    ];
    for (const role of ["funder", "contributor", "operator"] as const) {
      expect(rankForRole(items, role)).toHaveLength(items.length);
      expect(rankForRole(items, role).map((i) => i.id).sort()).toEqual([
        "a",
        "b",
        "c",
      ]);
    }
  });

  it("is stable and deterministic for equal scores", () => {
    const items = [
      item({ id: "first", updatedAt: "2026-08-01T00:00:00.000Z" }),
      item({ id: "second", updatedAt: "2026-08-01T00:00:00.000Z" }),
    ];
    expect(rankForRole(items, "funder").map((i) => i.id)).toEqual([
      "first",
      "second",
    ]);
    expect(rankForRole(items, "funder").map((i) => i.id)).toEqual(
      rankForRole(items, "funder").map((i) => i.id),
    );
  });

  it("never scores popularity - only economic situation", () => {
    const plain = item({ id: "plain" });
    expect(scoreForRole(plain, "funder")).toBe(0);
  });

  it("infers operator when something is blocked on them, ahead of capital", () => {
    expect(
      inferPrimaryRole({
        operatesPools: true,
        hasSpendableCapital: true,
        hasPayoutDestination: true,
      }),
    ).toBe("operator");
    expect(
      inferPrimaryRole({
        operatesPools: false,
        hasSpendableCapital: true,
        hasPayoutDestination: true,
      }),
    ).toBe("funder");
    expect(
      inferPrimaryRole({
        operatesPools: false,
        hasSpendableCapital: false,
        hasPayoutDestination: true,
      }),
    ).toBe("contributor");
    // No capital, no payout destination -> funding needs no viewer setup.
    expect(
      inferPrimaryRole({
        operatesPools: false,
        hasSpendableCapital: false,
        hasPayoutDestination: false,
      }),
    ).toBe("funder");
  });
});
