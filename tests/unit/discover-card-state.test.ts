import { describe, expect, it } from "vitest";
import { deriveDiscoverCardState } from "../../src/lib/discover/discover-card-state";
import type { TrendingValueGap } from "../../src/lib/discover/types";

const EARNINGS_OPEN = /view earnings/i;

const baseGap = (overrides: Partial<TrendingValueGap> = {}): TrendingValueGap => ({
  id: "test-gap",
  domain: "music",
  headline: "Navidrome listens are unpaid artist value",
  why: "",
  whoBenefits: "",
  proofSource: "Navidrome",
  dataSource: "community_catalog",
  amountVerified: false,
  amountNeededUsd: 0,
  moneyCanMoveUsd: 0,
  peopleImpacted: 0,
  trendScore: 0,
  communitySlug: "navidrome",
  templateId: "user-centric-royalties",
  valueMetrics: {
    observedEvents: "Source not connected",
    payoutRules: "Rule missing",
    settlement: "Pool unfunded",
    verifiedSource: "Navidrome sessions",
  },
  actions: [
    { id: "connect", label: "Connect Navidrome", kind: "connect_sensor", communitySlug: "navidrome" },
    { id: "program", label: "Create royalty pool", kind: "create_program", communitySlug: "navidrome" },
    { id: "fund", label: "Fund artist pool", kind: "fund", communitySlug: "navidrome" },
    { id: "console", label: "Open console", kind: "console", communitySlug: "navidrome" },
    { id: "earn", label: "View earnings", kind: "open", href: "/capital" },
  ],
  ...overrides,
});

describe("deriveDiscoverCardState", () => {
  it("shows connect as primary when source not linked", () => {
    const state = deriveDiscoverCardState(baseGap(), null, "gaps", "funder", "trending-gaps");
    expect(state.primaryActions[0]?.kind).toBe("connect_sensor");
    expect(state.settlementStatus).toBe("Source not connected");
    expect(state.primaryActions.some((a) => EARNINGS_OPEN.test(a.label))).toBe(false);
  });

  it("hides view earnings when nothing claimable", () => {
    const state = deriveDiscoverCardState(baseGap(), null, "gaps", "community", "trending-gaps");
    expect(state.primaryActions.every((a) => !/view earnings/i.test(a.label))).toBe(true);
  });

  it("puts console in advanced", () => {
    const state = deriveDiscoverCardState(baseGap(), null, "gaps", "founder", "trending-gaps");
    expect(state.advancedActions.some((a) => a.kind === "console")).toBe(true);
    expect(state.primaryActions.some((a) => a.kind === "console")).toBe(false);
  });

  it("prefers fund when rule exists but pool unfunded", () => {
    const gap = baseGap({
      valueMetrics: {
        observedEvents: "Activity verified",
        payoutRules: "1 active",
        settlement: "Pool unfunded",
        verifiedSource: "Navidrome",
      },
      programId: "prog-1",
    });
    const connections = {
      signedIn: true,
      installedCommunitySlugs: ["navidrome"],
      githubUsername: null,
      platforms: { navidrome: { connected: true } },
      hasAnyConnector: true,
    } as import("@/lib/profile/connection-state-types").UserConnectionState;

    const state = deriveDiscoverCardState(gap, connections, "gaps", "funder", "trending-gaps");
    expect(state.primaryActions[0]?.kind).toBe("fund");
    expect(state.settlementStatus).toBe("Pool unfunded");
  });
});
