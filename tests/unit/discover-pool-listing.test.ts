import { describe, expect, it } from "vitest";
import { computePoolListingEligibility } from "@/lib/discover/marketplace/pool-listing";
import type { DiscoverPool } from "@/lib/discover/marketplace/contracts";

function pool(overrides: Partial<DiscoverPool>): DiscoverPool {
  return {
    id: "pool-1",
    name: "Test Pool",
    owner: "operator-1",
    communitySlug: "test-community",
    type: "royalty",
    eligibleOpportunityTypes: [],
    lifecycleState: "accepting_funding",
    publicationState: "approved",
    policyState: "active",
    treasuryReadiness: "ready",
    primaryAction: { id: "discover.open_pools" } as DiscoverPool["primaryAction"],
    secondaryActions: [],
    ...overrides,
  } as DiscoverPool;
}

describe("computePoolListingEligibility", () => {
  it("lists a fully configured, approved, funding-ready Pool", () => {
    expect(computePoolListingEligibility(pool({}))).toBe("MARKET_LISTED");
  });

  it("still lists a Pool that has moved on to distribution, not just 'accepting_funding'", () => {
    expect(
      computePoolListingEligibility(pool({ lifecycleState: "ready_for_distribution" })),
    ).toBe("MARKET_LISTED");
    expect(
      computePoolListingEligibility(pool({ lifecycleState: "completed" })),
    ).toBe("MARKET_LISTED");
  });

  it("routes an unmet policy prerequisite to operator setup, not the public market", () => {
    expect(
      computePoolListingEligibility(pool({ policyState: "setup_required" })),
    ).toBe("OPERATOR_SETUP_REQUIRED");
  });

  it("routes an unmet treasury prerequisite to operator setup", () => {
    expect(
      computePoolListingEligibility(pool({ treasuryReadiness: "setup_required" })),
    ).toBe("OPERATOR_SETUP_REQUIRED");
  });

  it("routes an incomplete Pool to operator setup even if publication/policy/treasury look fine", () => {
    expect(
      computePoolListingEligibility(pool({ lifecycleState: "setup_incomplete" })),
    ).toBe("OPERATOR_SETUP_REQUIRED");
  });

  it("treats an unmet setup prerequisite as taking precedence over publication review", () => {
    // A Pool can't legitimately reach publication review without policy/treasury
    // already being valid, but if data is ever inconsistent, an unmet
    // prerequisite must still win - it's the actual blocker.
    expect(
      computePoolListingEligibility(
        pool({ policyState: "setup_required", publicationState: "operator_review_required" }),
      ),
    ).toBe("OPERATOR_SETUP_REQUIRED");
  });

  it("routes a fully configured but not-yet-approved Pool to manual governance review, not the public market", () => {
    expect(
      computePoolListingEligibility(pool({ publicationState: "operator_review_required" })),
    ).toBe("MANUAL_GOVERNANCE_REVIEW");
  });

  it("marks a paused Pool inactive regardless of other state", () => {
    expect(
      computePoolListingEligibility(
        pool({ lifecycleState: "paused", publicationState: "approved" }),
      ),
    ).toBe("INACTIVE");
  });

  it("lists a Pool using the legacy publication/policy states", () => {
    expect(
      computePoolListingEligibility(
        pool({ publicationState: "legacy_active", policyState: "legacy_configured" }),
      ),
    ).toBe("MARKET_LISTED");
  });
});
