import { describe, expect, it } from "vitest";
import { dedupeTrendingGaps } from "../../src/lib/discover/gap-dedupe";
import { visibleDiscoverActions } from "../../src/lib/discover/discover-visible-actions";
import type { DiscoverAction, TrendingValueGap } from "../../src/lib/discover/types";

function gap(partial: Partial<TrendingValueGap> & Pick<TrendingValueGap, "id">): TrendingValueGap {
  return {
    domain: "oss",
    headline: "remix-run/remix — needs docs",
    why: "w",
    whoBenefits: "who",
    proofSource: "p",
    dataSource: "supabase_ledger",
    amountVerified: true,
    amountNeededUsd: 25,
    moneyCanMoveUsd: 25,
    peopleImpacted: 1,
    trendScore: 57,
    actions: [],
    ...partial,
  };
}

function action(kind: DiscoverAction["kind"], id = kind): DiscoverAction {
  return { id, kind, label: kind };
}

describe("dedupeTrendingGaps", () => {
  it("keeps one row per authorization id", () => {
    const rows = dedupeTrendingGaps([
      gap({ id: "a1", proofAuthorizationId: "auth-1", trendScore: 50 }),
      gap({ id: "a2", proofAuthorizationId: "auth-1", trendScore: 60 }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.trendScore).toBe(60);
  });

  it("dedupes identical headlines", () => {
    const headline = "remix-run/remix — authorized value — needs documentation";
    const rows = dedupeTrendingGaps([
      gap({ id: "1", headline, proofAuthorizationId: "x" }),
      gap({ id: "2", headline, proofAuthorizationId: "y" }),
    ]);
    expect(rows).toHaveLength(1);
  });
});

describe("visibleDiscoverActions", () => {
  it("shows fund before share on trending gaps", () => {
    const visible = visibleDiscoverActions(
      [action("share"), action("fund"), action("open")],
      "trending-gaps",
    );
    expect(visible.map((a) => a.kind)).toEqual(["fund", "open", "share"]);
  });

  it("strips claim on funder lanes but keeps fund", () => {
    const visible = visibleDiscoverActions(
      [action("claim"), action("fund"), action("share")],
      "trending-gaps",
    );
    expect(visible.map((a) => a.kind)).toEqual(["fund", "share"]);
  });
});
