import { describe, expect, it } from "vitest";
import { buildDiscoverCardNarrative } from "../../src/lib/discover/discover-card-narrative";
import type { TrendingValueGap } from "../../src/lib/discover/types";

const baseGap = (overrides: Partial<TrendingValueGap> = {}): TrendingValueGap => ({
  id: "test-gap",
  domain: "oss",
  headline: "React docs and security work has no payout program",
  why: "GitHub detected documentation contributions that cannot settle because no Docs Bounty program exists.",
  whoBenefits: "",
  proofSource: "GitHub · Open Collective",
  dataSource: "community_catalog",
  amountVerified: false,
  amountNeededUsd: 2430,
  moneyCanMoveUsd: 0,
  peopleImpacted: 18,
  trendScore: 0,
  communitySlug: "react",
  templateId: "docs-bounty",
  valueMetrics: {
    observedEvents: "12 merged PRs this week",
    payoutRules: "Rule missing",
    settlement: "Pool unfunded",
    verifiedSource: "GitHub · Open Collective",
  },
  actions: [],
  ...overrides,
});

describe("buildDiscoverCardNarrative", () => {
  it("builds evidence → problem → opportunity for unpaid value", () => {
    const narrative = buildDiscoverCardNarrative({
      gap: baseGap(),
      lane: "gaps",
      proofSource: "GitHub · Open Collective",
      connected: true,
      hasRule: false,
      funded: false,
      settled: false,
      opportunityState: "verified",
    });

    expect(narrative.evidence).toMatch(/GitHub/i);
    expect(narrative.problem).toMatch(/docs program/i);
    expect(narrative.problem).toMatch(/no docs program is active/i);
    expect(narrative.opportunity).toMatch(/estimated unpaid value/i);
    expect(narrative.opportunity).toMatch(/18/);
  });

  it("frames live signals around fresh proof", () => {
    const narrative = buildDiscoverCardNarrative({
      gap: baseGap({ domain: "music", communitySlug: "navidrome", templateId: "user-centric-royalties" }),
      lane: "radars",
      proofSource: "Navidrome · MusicBrainz",
      connected: true,
      hasRule: false,
      funded: false,
      settled: false,
      opportunityState: "verified",
    });

    expect(narrative.evidence).toMatch(/fresh plays/i);
    expect(narrative.problem).toMatch(/royalty pool/i);
  });

  it("explains disconnected source on funding board", () => {
    const narrative = buildDiscoverCardNarrative({
      gap: baseGap(),
      lane: "graph",
      proofSource: "GitHub · Open Collective",
      connected: false,
      hasRule: false,
      funded: false,
      settled: false,
      opportunityState: "detected",
    });

    expect(narrative.problem).toMatch(/Profile/i);
  });
});
