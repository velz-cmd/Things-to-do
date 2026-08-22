import { describe, expect, it } from "vitest";
import { sortMarketplaceOpportunities } from "@/lib/discover/marketplace/query";
import type { MarketplaceOpportunity } from "@/lib/discover/marketplace/contracts";

/**
 * Phase 1I: shared market inventory order must never depend on object
 * insertion order, connector response timing, or Promise resolution
 * order - only on the data itself, with an explicit id tie-breaker so
 * even genuinely tied records (same publishedAt, same funded amount)
 * produce the same order every time. Non-deterministic ordering is also
 * a hydration risk: if the server and client ever compute this list in a
 * different order, that's a real text-node mismatch.
 */
function item(overrides: Partial<MarketplaceOpportunity>): MarketplaceOpportunity {
  return {
    id: "item-1",
    slug: "item-1",
    title: "Item",
    summary: "",
    description: "",
    type: "grant",
    status: "active",
    creator: { type: "individual", name: "x", verified: true },
    skills: [],
    deliverables: [],
    evidenceRequirements: [],
    eligibility: [],
    provider: { preference: "open" },
    publishedAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    verificationStatus: "verified",
    riskFlags: [],
    source: { type: "test", id: "1" },
    ...overrides,
  } as MarketplaceOpportunity;
}

describe("sortMarketplaceOpportunities - deterministic ordering", () => {
  it("produces the exact same order across repeated calls on the same dataset, in any input order", () => {
    const base = [
      item({ id: "a", publishedAt: "2026-08-03T00:00:00.000Z" }),
      item({ id: "b", publishedAt: "2026-08-01T00:00:00.000Z" }),
      item({ id: "c", publishedAt: "2026-08-02T00:00:00.000Z" }),
    ];
    const shuffled = [base[2], base[0], base[1]];
    const first = sortMarketplaceOpportunities(base, { sort: "newest" }).map((i) => i.id);
    const second = sortMarketplaceOpportunities(shuffled, { sort: "newest" }).map((i) => i.id);
    expect(first).toEqual(["a", "c", "b"]);
    expect(second).toEqual(first);
  });

  it("breaks a genuine tie (identical publishedAt) deterministically by id, for every sort mode", () => {
    const tied = [
      item({ id: "z", publishedAt: "2026-08-01T00:00:00.000Z", funding: { fundedAmountUsd: 10 } }),
      item({ id: "a", publishedAt: "2026-08-01T00:00:00.000Z", funding: { fundedAmountUsd: 10 } }),
    ];
    for (const sort of ["newest", "most_funded", "most_active", "closing_soon"] as const) {
      const run1 = sortMarketplaceOpportunities(tied, { sort }).map((i) => i.id);
      const run2 = sortMarketplaceOpportunities([...tied].reverse(), { sort }).map((i) => i.id);
      expect(run1).toEqual(run2);
    }
  });
});
