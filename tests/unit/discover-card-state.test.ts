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

function primarySlot(state: ReturnType<typeof deriveDiscoverCardState>) {
  return state.actionSlots.find((s) => s.variant === "primary");
}

describe("deriveDiscoverCardState", () => {
  it("shows disabled fund + connect secondary for funder when source not linked", () => {
    const state = deriveDiscoverCardState(baseGap(), null, "gaps", "funder", "trending-gaps", {
      signedIn: true,
    });
    const primary = primarySlot(state);
    expect(primary?.action.kind).toBe("fund");
    expect(primary?.disabled).toBe(true);
    expect(primary?.disabledReason).toMatch(/Connect source/i);
    expect(state.settlementStatus).toBe("Source not connected");
    expect(state.actionSlots.some((s) => s.action.kind === "connect_sensor")).toBe(true);
  });

  it("shows connect as primary for operator when source not linked", () => {
    const state = deriveDiscoverCardState(baseGap(), null, "gaps", "operator", "trending-gaps", {
      signedIn: true,
    });
    expect(primarySlot(state)?.action.kind).toBe("connect_sensor");
  });

  it("blocks actions when signed out", () => {
    const state = deriveDiscoverCardState(baseGap(), null, "gaps", "funder", "trending-gaps", {
      signedIn: false,
    });
    expect(primarySlot(state)?.disabledReason).toBe("Sign in to continue");
  });

  it("hides view earnings when nothing claimable", () => {
    const state = deriveDiscoverCardState(baseGap(), null, "gaps", "community", "trending-gaps", {
      signedIn: true,
    });
    expect(state.actionSlots.every((s) => !EARNINGS_OPEN.test(s.action.label))).toBe(true);
  });

  it("keeps console in advanced — not a primary Unpaid Value CTA", () => {
    const connections = {
      signedIn: true,
      installedCommunitySlugs: ["navidrome"],
      githubUsername: null,
      platforms: { navidrome: { connected: true } },
      hasAnyConnector: true,
    } as import("../../src/lib/profile/connection-state-types").UserConnectionState;

    const state = deriveDiscoverCardState(baseGap(), connections, "gaps", "founder", "trending-gaps", {
      signedIn: true,
    });
    expect(state.actionSlots.some((a) => a.action.kind === "console")).toBe(false);
    expect(state.actionSlots.some((a) => /scan activity/i.test(a.action.label))).toBe(false);
  });

  it("Live Signals prefers automate over create program when verified", () => {
    const gap = baseGap({
      valueMetrics: {
        observedEvents: "Activity verified",
        payoutRules: "Rule missing",
        settlement: "Pool unfunded",
        verifiedSource: "Navidrome",
      },
    });
    const connections = {
      signedIn: true,
      installedCommunitySlugs: ["navidrome"],
      githubUsername: null,
      platforms: { navidrome: { connected: true } },
      hasAnyConnector: true,
    } as import("../../src/lib/profile/connection-state-types").UserConnectionState;

    const state = deriveDiscoverCardState(gap, connections, "radars", "operator", "radar-music", {
      signedIn: true,
    });
    const primary = primarySlot(state);
    expect(primary?.action.kind === "automate" || primary?.action.kind === "analyze").toBe(true);
    expect(state.actionSlots.some((s) => s.action.kind === "create_program")).toBe(false);
  });

  it("Value graph opens community — not install — when source not linked", () => {
    const gap = baseGap({
      actions: [
        { id: "install", label: "Set up Navidrome", kind: "install", communitySlug: "navidrome" },
        { id: "connect", label: "Connect Navidrome", kind: "connect_sensor", communitySlug: "navidrome" },
        { id: "fund", label: "Fund artist pool", kind: "fund", communitySlug: "navidrome" },
      ],
    });
    const state = deriveDiscoverCardState(gap, null, "graph", "founder", "board", { signedIn: true });
    expect(primarySlot(state)?.action.kind).toBe("console");
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
    } as import("../../src/lib/profile/connection-state-types").UserConnectionState;

    const state = deriveDiscoverCardState(gap, connections, "gaps", "funder", "trending-gaps", {
      signedIn: true,
      spendableUsd: 50,
    });
    expect(primarySlot(state)?.action.kind).toBe("fund");
    expect(primarySlot(state)?.disabled).toBeFalsy();
    expect(state.settlementStatus).toBe("Pool unfunded");
  });

  it("disables fund when Arc balance is low", () => {
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
    } as import("../../src/lib/profile/connection-state-types").UserConnectionState;

    const state = deriveDiscoverCardState(gap, connections, "gaps", "funder", "trending-gaps", {
      signedIn: true,
      spendableUsd: 2,
    });
    expect(primarySlot(state)?.disabled).toBe(true);
    expect(primarySlot(state)?.disabledReason).toMatch(/Arc USDC/i);
  });


  it("shows create reward program as primary for founder on Unpaid Value when verified", () => {
    const gap = baseGap({
      valueMetrics: {
        observedEvents: "Activity verified",
        payoutRules: "Rule missing",
        settlement: "Pool unfunded",
        verifiedSource: "Navidrome",
      },
    });
    const connections = {
      signedIn: true,
      installedCommunitySlugs: ["navidrome"],
      githubUsername: null,
      platforms: { navidrome: { connected: true } },
      hasAnyConnector: true,
    } as import("../../src/lib/profile/connection-state-types").UserConnectionState;

    const state = deriveDiscoverCardState(gap, connections, "gaps", "founder", "trending-gaps", {
      signedIn: true,
    });
    expect(primarySlot(state)?.action.kind).toBe("create_program");
  });

  it("treats 10 active rules as programmed not verified", () => {
    const gap = baseGap({
      valueMetrics: {
        observedEvents: "Activity verified",
        payoutRules: "10 active",
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
    } as import("../../src/lib/profile/connection-state-types").UserConnectionState;

    const state = deriveDiscoverCardState(gap, connections, "gaps", "funder", "trending-gaps", {
      signedIn: true,
      spendableUsd: 50,
    });
    expect(state.opportunityState).toBe("programmed");
    expect(primarySlot(state)?.action.kind).toBe("fund");
    expect(primarySlot(state)?.disabled).toBeFalsy();
  });
});
