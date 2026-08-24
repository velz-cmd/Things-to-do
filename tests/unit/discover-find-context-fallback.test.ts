import { describe, expect, it } from "vitest";
import { findContext } from "@/components/resolve/discover/marketplace/discover-marketplace";
import type { CanonicalEconomicState } from "@/lib/discover/marketplace/economic-state";
import type { DiscoverPageData, EconomicActionItem } from "@/lib/discover/marketplace/contracts";

/**
 * Phase 5 Release Slice 16 fix (live-verified regression): `data.economicActions`
 * is the VIEW-FILTERED feed, so a real work item's matching EconomicActionItem
 * can legitimately be missing or lack economicState even though the row
 * itself (a MarketplaceOpportunity) has real economicState and shows it in
 * its own one-line summary. Screenshotting the real Preview after Slice 16
 * shipped showed exactly this: a "Funding available" row's Details drawer
 * rendered a completely empty Funding section. findContext()'s fallback
 * closes this using the ALREADY-COMPUTED value from the row itself - never
 * a second resolver, never invented.
 */

function economicItem(overrides: Partial<EconomicActionItem> = {}): EconomicActionItem {
  return {
    id: "economic:github_evidence:evidence-1",
    subjectType: "accepted_work",
    subjectId: "evidence-1",
    headline: "headline",
    happened: "happened",
    whyItMatters: "why",
    lifecycle: "observed",
    audience: "public",
    evidenceIds: [],
    attributionState: "verified",
    fundingReadiness: "ready",
    recipientReadiness: "ready",
    primaryAction: { id: "discover.open_evidence", label: "View proof", href: "/", enabled: true, presentation: { kind: "navigation", target: "discover", secondary: false } },
    secondaryActions: [],
    visibility: "public",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  } as EconomicActionItem;
}

function pageData(economicActions: EconomicActionItem[]): DiscoverPageData {
  return { economicActions } as DiscoverPageData;
}

const realState: CanonicalEconomicState = {
  state: "funding_available",
  demand: true,
  eligibility: { eligible: true, reason: "eligible" },
  obligation: null,
  coverage: {
    requiredUsd: null,
    confirmedUsd: 0,
    pendingUsd: 0,
    remainingUsd: null,
    currency: "USDC",
    records: [],
    fullyCovered: false,
    dataAvailability: "available",
  },
  authorization: { required: false, granted: false },
  payout: "destination_ready",
  settlement: "not_started",
  mechanism: "direct_support",
  provenance: "economic_match",
  nextAction: "fund",
};

describe("findContext - fallback economicState (Release Slice 16 fix)", () => {
  it("backfills economicState onto a matched item that is missing it, using the row's own already-computed value", () => {
    const data = pageData([economicItem({ economicState: undefined })]);
    const result = findContext(data, "evidence-1", realState);
    expect(result?.economicState).toBe(realState);
  });

  it("never overrides a real economicState the matched item already has", () => {
    const ownState: CanonicalEconomicState = { ...realState, state: "fully_covered" };
    const data = pageData([economicItem({ economicState: ownState })]);
    const result = findContext(data, "evidence-1", realState);
    expect(result?.economicState).toBe(ownState);
  });

  it("without a fallback, behaves exactly as before - no change for every pre-existing caller", () => {
    const data = pageData([economicItem({ economicState: undefined })]);
    const result = findContext(data, "evidence-1");
    expect(result?.economicState).toBeUndefined();
  });

  it("no match at all still returns undefined - never fabricates a whole EconomicActionItem from just a fallback state", () => {
    const data = pageData([]);
    const result = findContext(data, "evidence-1", realState);
    expect(result).toBeUndefined();
  });
});
