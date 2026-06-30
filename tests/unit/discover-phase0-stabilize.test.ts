import { describe, expect, it } from "vitest";
import {
  dedupeDiscoverBoard,
  dedupeFundablePrograms,
} from "../../src/lib/discover/board-dedupe";
import { dedupeLiveFeedEvents } from "../../src/lib/events/live-feed-dedupe";
import type { LiveEventItem } from "../../src/lib/events/live";
import type { FundableOpportunity } from "../../src/lib/capital/community-yield";

function liveEvent(partial: Partial<LiveEventItem> & Pick<LiveEventItem, "id" | "kind" | "title">): LiveEventItem {
  return {
    detail: "",
    at: new Date().toISOString(),
    evidence: "proof",
    ...partial,
  };
}

function program(
  partial: Partial<FundableOpportunity> & Pick<FundableOpportunity, "programId">,
): FundableOpportunity {
  return {
    programName: "Program",
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
    metricKind: "fulfillment",
    ...partial,
  };
}

describe("dedupeLiveFeedEvents", () => {
  it("keeps one authorization row per repo + event type", () => {
    const events = [
      liveEvent({
        id: "a1",
        kind: "authorization",
        title: "Documentation merged",
        detail: "facebook/react",
        eventType: "contribution.merge",
        connectorId: "github",
      }),
      liveEvent({
        id: "a2",
        kind: "authorization",
        title: "Documentation merged",
        detail: "facebook/react",
        eventType: "contribution.merge",
        connectorId: "github",
      }),
      liveEvent({
        id: "a3",
        kind: "authorization",
        title: "Arc settlement",
        detail: "vercel/next.js",
        eventType: "settlement",
        connectorId: "github",
      }),
    ];

    const deduped = dedupeLiveFeedEvents(events);
    expect(deduped).toHaveLength(2);
    expect(deduped.map((e) => e.id)).toEqual(["a1", "a3"]);
  });

  it("dedupes mission_created timeline rows", () => {
    const events = [
      liveEvent({
        id: "t1",
        kind: "timeline",
        title: "Mission",
        detail: "Fund docs",
        eventType: "mission_created",
      }),
      liveEvent({
        id: "t2",
        kind: "timeline",
        title: "Mission",
        detail: "Fund docs",
        eventType: "mission_created",
      }),
    ];

    expect(dedupeLiveFeedEvents(events)).toHaveLength(1);
  });
});

describe("dedupeFundablePrograms", () => {
  it("keeps highest score per program and community template", () => {
    const programs = [
      program({ programId: "p1", score: 5, communitySlug: "react", templateId: "docs-bounty" }),
      program({ programId: "p1", score: 12, communitySlug: "react", templateId: "docs-bounty" }),
      program({ programId: "p2", score: 8, communitySlug: "react", templateId: "docs-bounty" }),
      program({ programId: "p3", score: 20, communitySlug: "navidrome", templateId: "royalties" }),
    ];

    const deduped = dedupeFundablePrograms(programs);
    expect(deduped).toHaveLength(2);
    expect(deduped.find((p) => p.communitySlug === "react")?.score).toBe(12);
    expect(deduped.find((p) => p.communitySlug === "navidrome")?.programId).toBe("p3");
  });
});

describe("dedupeDiscoverBoard", () => {
  it("dedupes community connect rows by slug", () => {
    const items = [
      { ...program({ programId: "p1", score: 15 }), boardKind: "program" as const },
      {
        boardKind: "community" as const,
        programId: "community-react",
        programName: "React",
        communitySlug: "react",
        communityName: "React",
        communityTagline: "",
        templateId: "docs-bounty",
        templateLabel: "Docs",
        fundingGapUsd: 80,
        whyFund: "why",
        whoBenefits: "who",
        score: 5,
        metricKind: "connect" as const,
        connectCta: "Connect",
        connectHref: "/communities/react",
      },
      {
        boardKind: "community" as const,
        programId: "community-react-dup",
        programName: "React dup",
        communitySlug: "react",
        communityName: "React",
        communityTagline: "",
        templateId: "docs-bounty",
        templateLabel: "Docs",
        fundingGapUsd: 80,
        whyFund: "why",
        whoBenefits: "who",
        score: 3,
        metricKind: "connect" as const,
        connectCta: "Connect",
        connectHref: "/communities/react",
      },
    ];

    const deduped = dedupeDiscoverBoard(items);
    expect(deduped.filter((i) => i.boardKind === "community")).toHaveLength(1);
    expect(deduped.filter((i) => i.boardKind === "program")).toHaveLength(1);
  });
});
