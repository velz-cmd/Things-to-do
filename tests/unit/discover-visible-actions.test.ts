import { describe, expect, it } from "vitest";
import { dedupeTrendingGaps } from "../../src/lib/discover/gap-dedupe";
import { visibleDiscoverActions } from "../../src/lib/discover/discover-visible-actions";
import {
  DISCOVER_HIDDEN_ACTION_KINDS,
  filterValueReceiptActions,
  fulfillPoolLabel,
} from "../../src/lib/discover/discover-receipt-actions";
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
  it("prioritizes fund and caps at 3 actions", () => {
    const visible = visibleDiscoverActions(
      [
        action("share"),
        action("fund"),
        { id: "proof", kind: "open", label: "View proof", href: "/receipt/abc" },
        action("connect_sensor"),
        action("analyze"),
      ],
      "trending-gaps",
    );
    expect(visible.map((a) => a.kind)).toEqual(["fund", "connect_sensor", "open"]);
  });

  it("strips claim and hidden kinds on funder lanes", () => {
    const visible = visibleDiscoverActions(
      [action("claim"), action("fund"), action("install"), action("automate")],
      "trending-gaps",
    );
    expect(visible.map((a) => a.kind)).toEqual(["fund"]);
  });
});

describe("discover-receipt-actions", () => {
  it("filters cosmetic action kinds", () => {
    const filtered = filterValueReceiptActions([
      action("fund"),
      action("create_program"),
      action("analyze"),
      action("connect_sensor"),
    ]);
    expect(filtered.map((a) => a.kind)).toEqual(["fund", "connect_sensor"]);
    for (const kind of DISCOVER_HIDDEN_ACTION_KINDS) {
      expect(filtered.some((a) => a.kind === kind)).toBe(false);
    }
  });

  it("uses unified fulfill pool label", () => {
    expect(fulfillPoolLabel("docs-bounty")).toBe("Fulfill pool");
  });
});
