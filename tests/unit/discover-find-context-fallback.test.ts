import { describe, expect, it } from "vitest";
import { findContext } from "@/components/resolve/discover/marketplace/discover-marketplace";
import type { CanonicalEconomicState } from "@/lib/discover/marketplace/economic-state";
import type {
  DiscoverPageData,
  EconomicActionItem,
  MarketplaceOpportunity,
} from "@/lib/discover/marketplace/contracts";

/**
 * Phase 5 Release Slice 16 fix (two real root causes found via live
 * screenshot verification against the actual Preview deployment, not
 * guessed): `data.economicActions` is the VIEW-FILTERED feed (query.ts
 * filters it by intent/view before serializing it to the client), so a
 * real work item can be excluded from it ENTIRELY - not merely present
 * with a missing field - while its own row (a `MarketplaceOpportunity`)
 * still renders fine, since rows read `economicState` directly off
 * themselves, a completely separate data path. A first fix attempt only
 * patched the "found but missing economicState" case; re-screenshotting
 * proved the real case here was a full miss, which that version left
 * broken. This version handles both, and when there's a full miss, builds
 * a REAL EconomicActionItem via the same actionFromOpportunity() the
 * server-side feed itself uses - never a fabricated object.
 */

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

function opportunity(overrides: Partial<MarketplaceOpportunity> = {}): MarketplaceOpportunity {
  return {
    id: "work-1",
    slug: "work-1",
    title: "Fix authentication bypass",
    summary: "",
    description: "",
    type: "repository_fix",
    status: "open",
    category: "security",
    creator: { type: "person", id: "user-2", name: "@dev", verified: true },
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
    economicState: realState,
    ...overrides,
  } as MarketplaceOpportunity;
}

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

describe("findContext - fallback opportunity (Release Slice 16 fix)", () => {
  it("the full-miss case (this session's real bug): builds a real item via actionFromOpportunity() when nothing matches in the filtered feed", () => {
    const data = pageData([]);
    const result = findContext(data, "evidence-1", opportunity());
    expect(result?.economicState).toBe(realState);
    expect(result?.subjectId).toBe("evidence-1");
  });

  it("backfills economicState onto a matched item that is missing it, using the row's own real value", () => {
    const data = pageData([economicItem({ economicState: undefined })]);
    const result = findContext(data, "evidence-1", opportunity());
    expect(result?.economicState).toBe(realState);
  });

  it("never overrides a real economicState the matched item already has", () => {
    const ownState: CanonicalEconomicState = { ...realState, state: "fully_covered" };
    const data = pageData([economicItem({ economicState: ownState })]);
    const result = findContext(data, "evidence-1", opportunity());
    expect(result?.economicState).toBe(ownState);
  });

  it("without a fallback opportunity, behaves exactly as before - no change for every pre-existing caller", () => {
    const data = pageData([economicItem({ economicState: undefined })]);
    const result = findContext(data, "evidence-1");
    expect(result?.economicState).toBeUndefined();
  });

  it("no match and no fallback opportunity still returns undefined - never fabricates data from nothing", () => {
    const data = pageData([]);
    const result = findContext(data, "evidence-1");
    expect(result).toBeUndefined();
  });
});
