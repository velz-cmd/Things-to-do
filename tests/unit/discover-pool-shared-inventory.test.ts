import { describe, expect, it } from "vitest";
import { listPools } from "@/lib/discover/marketplace/query";
import { isMarketListedPool } from "@/lib/discover/marketplace/pool-listing";
import type { MarketplaceOpportunity } from "@/lib/discover/marketplace/contracts";

/**
 * Invariant: the public market-listed Pool inventory must never depend on
 * who is looking. This is the exact class of bug found live - an operator's
 * own undeployed draft (financialReadiness overridden to "setup_required" by
 * loadOperatorProgramOpportunities) must never appear market-listed to
 * anyone, including its own operator; a genuinely public, ready Pool must
 * appear identically to every viewer.
 */
function poolOpportunity(overrides: Partial<MarketplaceOpportunity>): MarketplaceOpportunity {
  return {
    id: "opp-1",
    slug: "opp-1",
    title: "Security response fund",
    summary: "",
    description: "",
    type: "grant",
    status: "active",
    creator: { type: "individual", id: "operator-1", name: "Operator", verified: true },
    community: { id: "react", name: "React" },
    pool: { id: "pool-1", name: "Security response fund" },
    skills: [],
    deliverables: [],
    evidenceRequirements: [],
    eligibility: [],
    provider: { preference: "open" },
    publishedAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    verificationStatus: "verified",
    riskFlags: [],
    source: { type: "community_program", id: "program-1" },
    marketplaceKind: "pool",
    entityState: {
      provenance: "operator_created",
      lifecycle: "published",
      financialReadiness: "ready",
    },
    secondaryActions: [],
    ...overrides,
  } as MarketplaceOpportunity;
}

describe("Pool shared-inventory invariant", () => {
  const genuinelyPublicPool = poolOpportunity({
    id: "opp-public",
    pool: { id: "pool-public", name: "Genuinely public Pool" },
    entityState: {
      provenance: "operator_created",
      lifecycle: "published",
      financialReadiness: "ready",
    },
  });

  const undeployedDraftPool = poolOpportunity({
    id: "opp-draft",
    creator: { type: "individual", id: "operator-1", name: "Operator", verified: true },
    pool: { id: "pool-draft", name: "Undeployed draft Pool" },
    // This is exactly what loadOperatorProgramOpportunities now forces for
    // a Program that hasn't cleared programEntityVisible - looks internally
    // "ready" in every other field, but financialReadiness is overridden.
    entityState: {
      provenance: "operator_created",
      lifecycle: "configured",
      financialReadiness: "setup_required",
      blocker: "Not yet deployed to a public Mission.",
    },
  });

  const opportunities = [genuinelyPublicPool, undeployedDraftPool];

  it("shows the identical market-listed Pool ID set to a normal user, the draft's own operator, and no viewer at all", () => {
    const marketListedIdsFor = (viewerUserId?: string) =>
      listPools(opportunities, viewerUserId)
        .filter(isMarketListedPool)
        .map((p) => p.id)
        .sort();

    const forNormalUser = marketListedIdsFor("some-other-user");
    const forOperator = marketListedIdsFor("operator-1");
    const forAnonymous = marketListedIdsFor(undefined);

    expect(forNormalUser).toEqual(["pool-public"]);
    expect(forOperator).toEqual(["pool-public"]);
    expect(forAnonymous).toEqual(["pool-public"]);
  });

  it("never lets an operator-owned undeployed draft claim market-listed, confirmed public readiness", () => {
    const asOperator = listPools(opportunities, "operator-1");
    const draft = asOperator.find((p) => p.id === "pool-draft")!;
    expect(isMarketListedPool(draft)).toBe(false);
    expect(draft.lifecycleState).not.toBe("accepting_funding");
  });

  it("keeps a genuinely ready Pool market-listed for its own operator too", () => {
    const publicPoolAsOperator = poolOpportunity({
      id: "opp-own-public",
      creator: { type: "individual", id: "operator-2", name: "Operator Two", verified: true },
      pool: { id: "pool-own-public", name: "Operator's own deployed Pool" },
      entityState: {
        provenance: "operator_created",
        lifecycle: "published",
        financialReadiness: "ready",
      },
    });
    const [result] = listPools([publicPoolAsOperator], "operator-2");
    expect(isMarketListedPool(result)).toBe(true);
  });
});
