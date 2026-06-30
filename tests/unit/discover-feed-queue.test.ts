import { describe, expect, it } from "vitest";
import { liveFeedEventLabel, isSettledEvent } from "../../src/lib/events/live-feed-labels";
import { dedupeQueueWithTrending, trendingProgramIds } from "../../src/lib/discover/queue-dedupe";
import {
  liveEventActions,
  primaryLiveEventAction,
  receiptHrefForEvent,
} from "../../src/lib/discover/live-feed-actions";
import type { LiveEventItem } from "../../src/lib/events/live";
import type { TrendingValueGap } from "../../src/lib/discover/types";

function gap(partial: Partial<TrendingValueGap> & Pick<TrendingValueGap, "id">): TrendingValueGap {
  return {
    domain: "community",
    headline: "h",
    why: "w",
    whoBenefits: "who",
    proofSource: "p",
    dataSource: "supabase_ledger",
    amountVerified: true,
    amountNeededUsd: 10,
    moneyCanMoveUsd: 10,
    peopleImpacted: 1,
    trendScore: 1,
    actions: [],
    ...partial,
  };
}

describe("live feed labels", () => {
  it("maps event types to Discover heartbeat labels", () => {
    expect(
      liveFeedEventLabel({
        kind: "authorization",
        title: "",
        eventType: "contribution.merge",
        status: "authorized",
      }),
    ).toBe("PR merged");
    expect(
      liveFeedEventLabel({
        kind: "timeline",
        title: "Funded pool",
        eventType: "community_funded",
      }),
    ).toBe("Program funded");
    expect(
      liveFeedEventLabel({ kind: "authorization", title: "", status: "settled" }),
    ).toBe("Arc settlement");
    expect(
      liveFeedEventLabel({ kind: "timeline", title: "x", eventType: "sensor_sync" }),
    ).toBe("Sensor connected");
  });

  it("detects settled events for receipt links", () => {
    expect(isSettledEvent({ status: "settled" })).toBe(true);
    expect(isSettledEvent({ status: "claimed" })).toBe(true);
    expect(isSettledEvent({ status: "pending_funding" })).toBe(false);
  });
});

describe("live feed actions", () => {
  const base: LiveEventItem = {
    id: "auth-abc123",
    kind: "authorization",
    title: "Arc settlement",
    detail: "react/docs",
    amountUsd: 12,
    status: "settled",
    entityPath: "/e/repo/facebook/react",
    at: new Date().toISOString(),
    evidence: "proof",
  };

  it("every event has at least one action", () => {
    expect(liveEventActions(base).length).toBeGreaterThan(0);
    expect(liveEventActions({ ...base, entityPath: undefined, status: undefined }).length).toBeGreaterThan(0);
  });

  it("primary action is receipt when settled", () => {
    const primary = primaryLiveEventAction(base);
    expect(primary.label).toBe("View receipt");
    expect(receiptHrefForEvent(base)).toBe("/receipt/abc123");
  });

  it("pending funding primary is fund", () => {
    const primary = primaryLiveEventAction({ ...base, status: "pending_funding" });
    expect(primary.kind).toBe("fund");
  });
});

describe("queue dedupe with trending", () => {
  it("removes programs already in trending gaps", () => {
    const gaps = [
      gap({ id: "program-p1", programId: "p1", headline: "React fund" }),
      gap({ id: "oss-foo/bar", headline: "repo" }),
    ];
    const opportunities = [
      {
        programId: "p1",
        programName: "React",
        communitySlug: "react",
        communityName: "React",
        communityTagline: "",
        templateId: "docs-bounty",
        templateLabel: "Docs",
        status: "active",
        budgetUsd: 100,
        principalFundedUsd: 50,
        fundingGapUsd: 50,
        impactValueUsd: 80,
        projectedYieldAt2x: 200,
        yieldMultiplier: 1.2,
        targetMultiplier: 2,
        settlementRate: 0.8,
        contributorCount: 3,
        signalCount: 5,
        whyFund: "why",
        whoBenefits: "who",
        score: 10,
        metricKind: "fulfillment" as const,
      },
      {
        programId: "p2",
        programName: "Music",
        communitySlug: "navidrome",
        communityName: "Navidrome",
        communityTagline: "",
        templateId: "user-centric-royalties",
        templateLabel: "Royalties",
        status: "active",
        budgetUsd: 50,
        principalFundedUsd: 10,
        fundingGapUsd: 40,
        impactValueUsd: 30,
        projectedYieldAt2x: 100,
        yieldMultiplier: 1,
        targetMultiplier: 2,
        settlementRate: 0.5,
        contributorCount: 2,
        signalCount: 2,
        whyFund: "why",
        whoBenefits: "who",
        score: 8,
        metricKind: "fulfillment" as const,
      },
    ];
    expect(trendingProgramIds(gaps)).toEqual(new Set(["p1"]));
    const deduped = dedupeQueueWithTrending(opportunities, gaps);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].programId).toBe("p2");
  });
});
