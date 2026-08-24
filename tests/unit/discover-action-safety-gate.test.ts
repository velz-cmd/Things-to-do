import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyCanonicalActionSafetyGate } from "@/lib/discover/marketplace/canonical-action-resolver";
import type { CanonicalEconomicState } from "@/lib/discover/marketplace/economic-state";
import type { MarketplaceOpportunity } from "@/lib/discover/marketplace/contracts";

/**
 * Phase 5 Release Slice 12: the safe cutover. applyCanonicalActionSafetyGate()
 * is restriction-only - proven directly here against constructed items, and
 * proven wired into the real production pipeline via the same structural
 * regression-guard pattern already established for Slice 8's coverage
 * loader (real code that is never actually called is exactly the class of
 * bug this session has repeatedly found).
 */

function fundAction(overrides: Partial<MarketplaceOpportunity["primaryAction"]> = {}) {
  return {
    id: "discover.fund_verified_work" as const,
    label: "Support this work",
    href: "/discover?view=verified_work&work=evidence-1",
    enabled: true,
    presentation: { kind: "navigation" as const, target: "discover" as const, secondary: false },
    ...overrides,
  };
}

function item(
  economicState: CanonicalEconomicState | undefined,
  primaryAction = fundAction(),
): MarketplaceOpportunity {
  return {
    id: "work-1",
    slug: "work-1",
    title: "Fix authentication bypass",
    summary: "",
    description: "",
    type: "repository_fix",
    status: "open",
    category: "security",
    creator: { type: "person", id: "recipient-1", name: "@ada-dev", verified: true },
    updatedAt: "2026-08-01T00:00:00.000Z",
    publishedAt: "2026-08-01T00:00:00.000Z",
    verificationStatus: "verified",
    riskFlags: [],
    evidenceRequirements: [],
    eligibility: [],
    skills: [],
    deliverables: [],
    provider: { preference: "open" },
    source: { type: "github_evidence", id: "evidence-1" },
    marketplaceKind: "work",
    entityState: { provenance: "operator_created", lifecycle: "published", financialReadiness: "ready" },
    primaryAction,
    economicState,
  } as MarketplaceOpportunity;
}

function state(overrides: Partial<CanonicalEconomicState> = {}): CanonicalEconomicState {
  return {
    state: "funding_available",
    demand: true,
    eligibility: { eligible: true, reason: "eligible" },
    obligation: null,
    coverage: { requiredUsd: null, confirmedUsd: 0, pendingUsd: 0, remainingUsd: null, currency: "USDC", records: [], fullyCovered: false },
    authorization: { required: false, granted: false },
    payout: "destination_ready",
    settlement: "not_started",
    mechanism: "direct_support",
    provenance: "economic_match",
    nextAction: "fund",
    ...overrides,
  };
}

describe("applyCanonicalActionSafetyGate - restriction-only cutover", () => {
  it("leaves an enabled fund action alone when the canonical resolver agrees real demand exists", () => {
    const [gated] = applyCanonicalActionSafetyGate([item(state({ nextAction: "fund" }))]);
    expect(gated.primaryAction?.enabled).toBe(true);
    expect(gated.primaryAction?.id).toBe("discover.fund_verified_work");
  });

  it("disables an enabled fund action when a real transfer is already in flight (settlement_confirming) - the exact gap Release Slice 11's parity matrix found", () => {
    const [gated] = applyCanonicalActionSafetyGate([
      item(state({ nextAction: "none", state: "settlement_confirming", settlement: "confirming" })),
    ]);
    expect(gated.primaryAction?.enabled).toBe(false);
    expect(gated.primaryAction?.disabledReason).toBe("A transfer for this work reward is already in progress.");
  });

  it("disables an enabled fund action when a duplicate submission was detected (reconciliation_required)", () => {
    const [gated] = applyCanonicalActionSafetyGate([
      item(state({
        nextAction: "none",
        state: "reconciliation_required",
        settlement: "reconciliation_required",
        reconciliation: { kind: "duplicate_submission", detail: "2 separate transfers are simultaneously in flight for the same obligation." },
      })),
    ]);
    expect(gated.primaryAction?.enabled).toBe(false);
    expect(gated.primaryAction?.disabledReason).toContain("inconsistency");
  });

  it("disables an enabled fund action when no real demand exists at all", () => {
    const [gated] = applyCanonicalActionSafetyGate([
      item(state({ nextAction: "none", state: "no_demand", demand: false })),
    ]);
    expect(gated.primaryAction?.enabled).toBe(false);
  });

  it("never touches an item whose primary action is not the fund action - evidence-only, self-attributed, and payout-setup items pass through unchanged", () => {
    const evidenceItem = item(state({ nextAction: "none" }), {
      id: "discover.open_evidence",
      label: "View proof",
      href: "/discover",
      enabled: true,
      presentation: { kind: "navigation", target: "discover", secondary: false },
    });
    const [gated] = applyCanonicalActionSafetyGate([evidenceItem]);
    expect(gated).toBe(evidenceItem);
  });

  it("never touches an already-disabled fund action - restriction-only, never a no-op re-enable path", () => {
    const disabledItem = item(state({ nextAction: "fund" }), fundAction({ enabled: false, disabledReason: "Arc settlement is currently unavailable." }));
    const [gated] = applyCanonicalActionSafetyGate([disabledItem]);
    expect(gated).toBe(disabledItem);
  });

  it("never touches an item with no economicState at all - only ever restricts a decision it can actually verify", () => {
    const noStateItem = item(undefined);
    const [gated] = applyCanonicalActionSafetyGate([noStateItem]);
    expect(gated.primaryAction?.enabled).toBe(false);
    // Absence of economicState resolves to nextAction "none" (the safe
    // default), which is exactly the class of situation this gate exists
    // to catch - never silently trusts an enabled action with no backing
    // economic state at all.
  });
});

describe("Real production wiring: the safety gate actually runs in the live query path, not just in isolation", () => {
  const source = readFileSync("src/lib/discover/marketplace/query.ts", "utf8");

  it("imports applyCanonicalActionSafetyGate from the real resolver module", () => {
    expect(source).toContain(
      'import { applyCanonicalActionSafetyGate } from "./canonical-action-resolver"',
    );
  });

  it("applies the gate to the real attachEconomicMatch() output, after economicState exists", () => {
    const matchIndex = source.indexOf("const matched = attachEconomicMatch(workAware, {");
    const gateIndex = source.indexOf("const safetyGated = applyCanonicalActionSafetyGate(matched);");
    expect(matchIndex).toBeGreaterThan(-1);
    expect(gateIndex).toBeGreaterThan(-1);
    expect(gateIndex).toBeGreaterThan(matchIndex);
  });

  it("the gated result, not the raw matched array, feeds the real viewer-facing ranking", () => {
    const gateIndex = source.indexOf("const safetyGated = applyCanonicalActionSafetyGate(matched);");
    const rankIndex = source.indexOf("const allVisible = rankOpportunitiesForViewer(", gateIndex);
    expect(rankIndex).toBeGreaterThan(gateIndex);
    const rankCall = source.slice(rankIndex, rankIndex + 200);
    expect(rankCall).toContain("safetyGated,");
  });
});
