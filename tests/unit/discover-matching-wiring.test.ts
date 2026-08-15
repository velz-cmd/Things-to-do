import { describe, expect, it } from "vitest";
import {
  attachEconomicMatch,
  fundingIntentsFromPools,
  outcomeClassFor,
} from "../../src/lib/discover/marketplace/attach-economic-match";
import { rankOpportunitiesForViewer } from "../../src/lib/discover/marketplace/role-ranked";
import type {
  DiscoverPool,
  MarketplaceOpportunity,
} from "../../src/lib/discover/marketplace/contracts";

function pool(overrides: Partial<DiscoverPool> = {}): DiscoverPool {
  return {
    id: "pool-1",
    name: "Security Response Fund",
    owner: "Ada",
    communitySlug: "linux",
    type: "security response fund",
    availableUsd: 500,
    eligibleOpportunityTypes: [],
    lifecycleState: "accepting_funding",
    publicationState: "approved",
    policyState: "active",
    treasuryReadiness: "ready",
    primaryAction: {
      id: "capital.open_funding",
      label: "Fund Pool",
      href: "/discover",
      presentation: { kind: "navigation", href: "/discover" },
    },
    secondaryActions: [],
    ...overrides,
  } as DiscoverPool;
}

function work(overrides: Partial<MarketplaceOpportunity> = {}): MarketplaceOpportunity {
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
    entityState: {
      provenance: "operator_created",
      lifecycle: "published",
      financialReadiness: "ready",
    },
    ...overrides,
  } as MarketplaceOpportunity;
}

describe("economic matching is wired into the marketplace", () => {
  it("attaches a match to verified work instead of leaving it to tests only", () => {
    const [item] = attachEconomicMatch([work()], { pools: [pool()] });
    expect(item.economicMatch).toBeDefined();
    expect(item.economicMatch?.eligible.length ?? 0).toBeGreaterThan(0);
  });

  it("withholds delegated Pool capital when impact is not sourced", () => {
    // A merge alone is provenance. Pool capital carries a mandate and must
    // not be unlocked by activity with no adoption evidence behind it.
    const [item] = attachEconomicMatch([work()], { pools: [pool()] });
    const poolMatch = item.economicMatch?.eligible.find(
      (entry) => entry.intent.mechanism === "pool_allocation",
    );
    expect(poolMatch).toBeUndefined();
    expect(
      item.economicMatch?.excluded.some(
        (entry) => entry.intent.mechanism === "pool_allocation",
      ),
    ).toBe(true);
  });

  it("still offers direct support, which is the viewer's own intent", () => {
    const [item] = attachEconomicMatch([work()], { pools: [] });
    expect(item.economicMatch?.recommended).toBe("direct_support");
  });

  it("does not offer direct support when the recipient cannot settle", () => {
    const [item] = attachEconomicMatch(
      [
        work({
          entityState: {
            provenance: "operator_created",
            lifecycle: "published",
            financialReadiness: "setup_required",
            blocker: "This contributor has not verified where rewards settle.",
          },
        }),
      ],
      { pools: [] },
    );
    expect(item.economicMatch?.recommended).toBeNull();
    expect(item.economicMatch?.excluded.length ?? 0).toBeGreaterThan(0);
  });

  it("reports a Pool's real blocker as the exclusion reason", () => {
    const [item] = attachEconomicMatch([work()], {
      pools: [
        pool({
          lifecycleState: "setup_incomplete",
          blocker: "Add a valid Arc treasury destination.",
        }),
      ],
    });
    expect(
      item.economicMatch?.excluded.some((entry) =>
        entry.reason.includes("treasury"),
      ),
    ).toBe(true);
  });

  it("leaves non-work records untouched", () => {
    const program = work({
      source: { type: "community_program", id: "program-1" },
      marketplaceKind: "pool",
    });
    const [item] = attachEconomicMatch([program], { pools: [pool()] });
    expect(item.economicMatch).toBeUndefined();
  });

  it("maps a Pool to the outcome class it is mandated to fund", () => {
    expect(fundingIntentsFromPools([pool()])[0]?.eligibleClasses).toEqual([
      "security",
    ]);
    expect(outcomeClassFor(work())).toBe("security");
  });
});

describe("role ranking orders without hiding", () => {
  const items = [
    work({ id: "a", updatedAt: "2026-08-01T00:00:00.000Z" }),
    work({
      id: "b",
      updatedAt: "2026-08-02T00:00:00.000Z",
      impactProfile: {
        measurable: true,
        signals: [
          {
            id: "dependents",
            label: "Dependent repositories",
            value: "14",
            scope: "repository",
            source: "Libraries.io",
            observedAt: "2026-08-02T00:00:00.000Z",
          },
        ],
      },
    }),
  ];

  it("keeps every record after ranking", () => {
    const ranked = rankOpportunitiesForViewer(items, "funder", "user-1");
    expect(ranked).toHaveLength(items.length);
    expect(new Set(ranked.map((item) => item.id))).toEqual(
      new Set(items.map((item) => item.id)),
    );
  });

  it("promotes sourced impact for a funder", () => {
    const ranked = rankOpportunitiesForViewer(items, "funder", "user-1");
    expect(ranked[0]?.id).toBe("b");
  });
});
