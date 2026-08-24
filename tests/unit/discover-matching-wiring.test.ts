import { describe, expect, it } from "vitest";
import {
  attachEconomicMatch,
  fundingIntentsFromCampaigns,
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

/** A funded, public Campaign/Request - real demand (Phase 5 section 14). */
function campaign(overrides: Partial<MarketplaceOpportunity> = {}): MarketplaceOpportunity {
  return {
    id: "campaign-1",
    slug: "campaign-1",
    title: "Fix the login race condition",
    summary: "",
    description: "",
    type: "campaign",
    status: "open",
    category: "security",
    creator: { type: "creator", id: "user-3", name: "Requester", verified: true },
    updatedAt: "2026-08-01T00:00:00.000Z",
    publishedAt: "2026-08-01T00:00:00.000Z",
    verificationStatus: "verified",
    riskFlags: [],
    evidenceRequirements: [],
    eligibility: [],
    skills: [],
    deliverables: [],
    provider: { preference: "open" },
    source: { type: "outcome_campaign", id: "campaign-source-1" },
    marketplaceKind: "opportunity",
    funding: {
      fundedAmountUsd: 0,
      goalAmountUsd: 200,
      status: "unfunded",
      source: "Outcome campaign budget",
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

  /**
   * Phase 5 Release Slice 7: purpose was a single hardcoded generic string
   * for every outcome, discarding each work's own real title/purpose.
   * Coverage is looked up per-work (source.id), so this never caused a
   * cross-work collision, but it also meant overlap comparisons described
   * a placeholder instead of something real.
   */
  it("uses the work's own real title as its purpose, never a generic placeholder", () => {
    const [item] = attachEconomicMatch(
      [work({ title: "Patch the SSRF vulnerability in the webhook handler" })],
      { pools: [] },
    );
    expect(item.economicMatch?.overlapReason).toContain(
      "No prior payment is recorded",
    );
    // Prove the real title flows through overlap comparison: a prior
    // payment recorded for the exact same title is same-purpose overlap.
    const [covered] = attachEconomicMatch(
      [work({ title: "Patch the SSRF vulnerability in the webhook handler" })],
      {
        pools: [],
        coverageBySourceId: new Map([
          [
            "evidence-1",
            [
              {
                id: "prior-1",
                mechanism: "direct_support",
                amountUsd: 20,
                purpose: "Patch the SSRF vulnerability in the webhook handler",
              },
            ],
          ],
        ]),
      },
    );
    expect(covered.economicMatch?.overlap).toBe("possible_overlap");
  });

  it("classifies a research_request outcome as research even without an explicit category", () => {
    expect(
      outcomeClassFor(work({ category: undefined, type: "research_request" })),
    ).toBe("research");
  });

  /**
   * Phase 2 item 5: software impact never generates money by itself. A
   * huge dependent count, a published release, or a resolved-looking
   * advisory must never, by themselves, turn into a funding amount or a
   * Pool match without a real Pool/Request/funding-intent actually
   * existing. The recommended amount must always come from the Pool's
   * own availableUsd, never a function of any impact signal's value.
   */
  it("a massive dependent-repository count never becomes a funding amount without a real Pool", () => {
    const [item] = attachEconomicMatch(
      [
        work({
          impactProfile: {
            measurable: true,
            signals: [
              {
                id: "dependent_repositories",
                label: "Dependent repositories",
                value: "999,999",
                scope: "repository",
                source: "Libraries.io",
                observedAt: "2026-08-01T00:00:00.000Z",
                classification: "observed",
              },
            ],
          },
        }),
      ],
      { pools: [] },
    );
    expect(item.economicMatch?.recommended).toBe("direct_support");
    expect(item.economicMatch?.eligible.every((m) => m.intent.mechanism !== "pool_allocation")).toBe(true);
  });

  it("a published release alone never unlocks a Pool match without real Pool capital", () => {
    const [item] = attachEconomicMatch(
      [
        work({
          type: "project_contribution",
          impactProfile: {
            measurable: true,
            signals: [
              {
                id: "advisories_with_published_fix",
                label: "Patched versions available for advisories",
                value: "3",
                scope: "repository",
                source: "GitHub Security Advisories",
                observedAt: "2026-08-01T00:00:00.000Z",
                classification: "observed",
              },
            ],
          },
        }),
      ],
      { pools: [] },
    );
    expect(item.economicMatch?.eligible.some((m) => m.intent.mechanism === "pool_allocation")).toBe(false);
  });

  it("a resolved-looking advisory signal never determines the recommended funding amount - only pool.availableUsd does", () => {
    const highAdvisoryCount = work({
      impactProfile: {
        measurable: true,
        signals: [
          {
            id: "advisories_with_published_fix",
            label: "Patched versions available for advisories",
            value: "50",
            scope: "repository",
            source: "GitHub Security Advisories",
            observedAt: "2026-08-01T00:00:00.000Z",
            classification: "observed",
          },
        ],
      },
    });
    const [item] = attachEconomicMatch([highAdvisoryCount], {
      pools: [pool({ availableUsd: 77 })],
      operatorOfPoolIds: new Set(["pool-1"]),
    });
    const poolMatch = item.economicMatch?.eligible.find(
      (m) => m.intent.mechanism === "pool_allocation",
    );
    expect(poolMatch?.intent.availableUsd).toBe(77);
  });

  /**
   * Phase 3 item 19: citation != funding demand. A research outcome now
   * feeds into the same deterministic matcher as software work (see
   * attach-economic-match.ts), and these prove the same invariant holds:
   * citation magnitude never manufactures a funding amount or a Pool
   * match without a real, eligible Pool/Request actually existing.
   */
  function researchWork(overrides: Partial<MarketplaceOpportunity> = {}): MarketplaceOpportunity {
    return work({
      type: "research_outcome",
      category: undefined,
      source: { type: "research_work", id: "doi:10.1/example" },
      entityState: {
        provenance: "external_integration",
        lifecycle: "confirmed",
        financialReadiness: "not_applicable",
      },
      ...overrides,
    });
  }

  it("10,000 citations with no funding intent produces no funding amount", () => {
    const [item] = attachEconomicMatch(
      [
        researchWork({
          impactProfile: {
            measurable: true,
            signals: [
              {
                id: "openalex_citations",
                label: "Times cited (OpenAlex)",
                value: "10,000",
                scope: "artifact",
                source: "OpenAlex",
                observedAt: "2026-08-01T00:00:00.000Z",
                classification: "observed",
              },
            ],
          },
        }),
      ],
      { pools: [] },
    );
    expect(item.economicMatch?.recommended).toBeNull();
    expect(
      item.economicMatch?.eligible.some((m) => m.intent.mechanism === "pool_allocation"),
    ).toBe(false);
  });

  it("0 citations with a real eligible research Pool may still match - eligibility is not gated on the citation number", () => {
    const [item] = attachEconomicMatch(
      [
        researchWork({
          impactProfile: {
            measurable: true,
            signals: [
              {
                id: "openalex_citations",
                label: "Times cited (OpenAlex)",
                value: "0",
                scope: "artifact",
                source: "OpenAlex",
                observedAt: "2026-08-01T00:00:00.000Z",
                classification: "observed",
              },
            ],
          },
        }),
      ],
      {
        pools: [pool({ type: "research grant pool", availableUsd: 200 })],
        operatorOfPoolIds: new Set(["pool-1"]),
      },
    );
    const poolMatch = item.economicMatch?.eligible.find(
      (m) => m.intent.mechanism === "pool_allocation",
    );
    expect(poolMatch).toBeDefined();
  });

  it("a citation-count discrepancy between sources never itself changes the funding amount", () => {
    const [item] = attachEconomicMatch(
      [
        researchWork({
          impactProfile: {
            measurable: true,
            signals: [
              {
                id: "openalex_citations",
                label: "Times cited (OpenAlex)",
                value: "31",
                scope: "artifact",
                source: "OpenAlex",
                observedAt: "2026-08-01T00:00:00.000Z",
                classification: "observed",
              },
              {
                id: "crossref_citations",
                label: "Times cited (Crossref)",
                value: "27",
                scope: "artifact",
                source: "Crossref",
                observedAt: "2026-08-01T00:00:00.000Z",
                classification: "observed",
              },
            ],
          },
        }),
      ],
      {
        pools: [pool({ type: "research grant pool", availableUsd: 90 })],
        operatorOfPoolIds: new Set(["pool-1"]),
      },
    );
    const poolMatch = item.economicMatch?.eligible.find(
      (m) => m.intent.mechanism === "pool_allocation",
    );
    expect(poolMatch?.intent.availableUsd).toBe(90);
  });

  it("research authorship alone never grants payout readiness or direct-support eligibility", () => {
    const [item] = attachEconomicMatch([researchWork()], { pools: [] });
    const direct = item.economicMatch?.eligible.find(
      (m) => m.intent.mechanism === "direct_support",
    );
    expect(direct).toBeUndefined();
  });

  /**
   * Phase 5 fix: listenbrainz_listen (media) items were entirely excluded
   * from attachEconomicMatch, so a real Creator Pool could never match a
   * verified play even though poolOutcomeClasses()/outcomeClassFor()
   * already handled the "creator" class correctly - the match was
   * unreachable, not absent. Mirrors the same negative-guarantee coverage
   * already proven for research (citation count never manufactures demand).
   */
  function mediaWork(overrides: Partial<MarketplaceOpportunity> = {}): MarketplaceOpportunity {
    return work({
      type: "creator_collaboration",
      category: undefined,
      source: { type: "listenbrainz_listen", id: "mbid:example" },
      entityState: {
        provenance: "external_integration",
        lifecycle: "confirmed",
        financialReadiness: "not_applicable",
      },
      impactProfile: {
        measurable: true,
        signals: [
          {
            id: "listenbrainz_verified_listen",
            label: "Verified listen",
            value: "1",
            scope: "artifact",
            source: "ListenBrainz",
            observedAt: "2026-08-01T00:00:00.000Z",
            classification: "observed",
          },
        ],
      },
      ...overrides,
    });
  }

  it("a verified listen with no funding intent produces no funding amount", () => {
    const [item] = attachEconomicMatch([mediaWork()], { pools: [] });
    expect(item.economicMatch?.recommended).toBeNull();
    expect(
      item.economicMatch?.eligible.some((m) => m.intent.mechanism === "pool_allocation"),
    ).toBe(false);
  });

  it("a real eligible Creator Pool may match a verified listen - the match is reachable, not manufactured", () => {
    const [item] = attachEconomicMatch([mediaWork()], {
      pools: [pool({ type: "creator royalty pool", availableUsd: 150 })],
      operatorOfPoolIds: new Set(["pool-1"]),
    });
    const poolMatch = item.economicMatch?.eligible.find(
      (m) => m.intent.mechanism === "pool_allocation",
    );
    expect(poolMatch).toBeDefined();
    expect(poolMatch?.intent.availableUsd).toBe(150);
  });

  it("a Pool funding a different class never matches a verified listen", () => {
    const [item] = attachEconomicMatch([mediaWork()], {
      pools: [pool({ type: "security response fund" })],
    });
    expect(
      item.economicMatch?.eligible.some((m) => m.intent.mechanism === "pool_allocation"),
    ).toBe(false);
  });

  it("playback observation alone never grants payout readiness or direct-support eligibility", () => {
    const [item] = attachEconomicMatch([mediaWork()], { pools: [] });
    const direct = item.economicMatch?.eligible.find(
      (m) => m.intent.mechanism === "direct_support",
    );
    expect(direct).toBeUndefined();
  });

  /**
   * Phase 5 Release Slice 3: attachEconomicMatch() now also attaches the
   * canonical economicState projection, so components read one field
   * instead of reimplementing the same funding/payout precedence logic.
   */
  describe("attaches the canonical economicState alongside economicMatch", () => {
    // attachEconomicMatch() always adds a direct_support intent (the
    // viewer's own voluntary option), so "no_demand" is unreachable
    // through this path - there is always at least one intent considered,
    // landing in eligible or excluded. With no Pool and no ready recipient,
    // that intent is excluded, which is genuinely "blocked" (demand was
    // considered, nothing could currently fund it), not "no demand at all".
    it("no Pool and no ready recipient -> blocked, not no_demand (direct_support was considered and excluded)", () => {
      const [item] = attachEconomicMatch([work({ entityState: undefined })], { pools: [] });
      expect(item.economicState?.state).toBe("blocked");
    });

    it("a ready recipient with a real eligible mechanism (direct_support here, since no Pool evidence exists) -> funding_available", () => {
      const [item] = attachEconomicMatch(
        [work({ entityState: { provenance: "operator_created", lifecycle: "published", financialReadiness: "ready" } })],
        { pools: [] },
      );
      expect(item.economicState?.state).toBe("funding_available");
      expect(item.economicState?.payout).toBe("destination_ready");
      expect(item.economicState?.mechanism).toBe("direct_support");
    });

    it("financialReadiness setup_required maps to destination_missing, overriding funding_available to payout_setup_required", () => {
      // Needs a real impactProfile so the Pool intent is genuinely eligible
      // (pool_allocation requires sourced evidence) - direct_support alone
      // would be excluded here (recipient not ready), so without evidence
      // neither mechanism would be eligible and the state would be
      // "blocked", not exercising the payout override this test checks.
      const [item] = attachEconomicMatch(
        [
          work({
            entityState: {
              provenance: "operator_created",
              lifecycle: "published",
              financialReadiness: "setup_required",
            },
            impactProfile: {
              measurable: true,
              signals: [
                {
                  id: "advisories_with_published_fix",
                  label: "Patched versions available for advisories",
                  value: "3",
                  scope: "repository",
                  source: "GitHub Security Advisories",
                  observedAt: "2026-08-01T00:00:00.000Z",
                  classification: "observed",
                },
              ],
            },
          }),
        ],
        { pools: [pool()], operatorOfPoolIds: new Set(["pool-1"]) },
      );
      expect(item.economicState?.payout).toBe("destination_missing");
      expect(item.economicState?.state).toBe("payout_setup_required");
    });

    it("financialReadiness not_applicable maps to not_required (media's real payout state today)", () => {
      const [item] = attachEconomicMatch([mediaWork()], { pools: [] });
      expect(item.economicState?.payout).toBe("not_required");
    });

    it("a non-work record never receives economicState, matching its economicMatch absence", () => {
      const program = work({
        source: { type: "community_program", id: "program-1" },
        marketplaceKind: "pool",
      });
      const [item] = attachEconomicMatch([program], { pools: [pool()] });
      expect(item.economicState).toBeUndefined();
    });
  });

  /**
   * Phase 5 Release Slice 6: "funded_request" was already a real
   * FundingMechanism value in economic-matching.ts, but nothing in this
   * codebase ever actually constructed one - a funded, public Campaign
   * could exist and still never match a real outcome. Mirrors the same
   * "the mechanism was unreachable, not absent" pattern already found and
   * fixed for media Pool matching.
   */
  describe("fundingIntentsFromCampaigns - real funded Requests/Campaigns are reachable demand", () => {
    it("a funded campaign with the matching category becomes an eligible funded_request intent", () => {
      const [intent] = fundingIntentsFromCampaigns([campaign()]);
      expect(intent).toMatchObject({
        mechanism: "funded_request",
        eligibleClasses: ["security"],
        availableUsd: 200,
        executable: true,
      });
    });

    it("remaining budget is goal minus already-committed funding, never re-derived from anything else", () => {
      const [intent] = fundingIntentsFromCampaigns([
        campaign({ funding: { fundedAmountUsd: 120, goalAmountUsd: 200, status: "partially_funded" } }),
      ]);
      expect(intent?.availableUsd).toBe(80);
    });

    it("a fully-committed campaign is still included, excluded with its real reason - never hidden", () => {
      const [intent] = fundingIntentsFromCampaigns([
        campaign({ funding: { fundedAmountUsd: 200, goalAmountUsd: 200, status: "funded" } }),
      ]);
      expect(intent?.availableUsd).toBe(0);
      expect(intent?.executable).toBe(false);
      expect(intent?.blocker).toContain("fully committed");
    });

    it("an expired campaign is not executable, with its real deadline reason", () => {
      const [intent] = fundingIntentsFromCampaigns([
        campaign({ deadline: "2020-01-01T00:00:00.000Z" }),
      ]);
      expect(intent?.executable).toBe(false);
      expect(intent?.blocker).toContain("deadline has passed");
    });

    it("a real funded campaign genuinely matches a same-class verified outcome through attachEconomicMatch end to end", () => {
      // funded_request requires sourced impact evidence, same as
      // pool_allocation (delegated capital carries a mandate) - a bare
      // work() fixture with no impactProfile would leave the campaign
      // excluded for missing evidence, not exercising the real match this
      // test checks.
      const [item] = attachEconomicMatch(
        [
          work({
            impactProfile: {
              measurable: true,
              signals: [
                {
                  id: "advisories_with_published_fix",
                  label: "Patched versions available for advisories",
                  value: "1",
                  scope: "repository",
                  source: "GitHub Security Advisories",
                  observedAt: "2026-08-01T00:00:00.000Z",
                  classification: "observed",
                },
              ],
            },
          }),
          campaign(),
        ],
        { pools: [] },
      );
      const requestMatch = item.economicMatch?.eligible.find(
        (m) => m.intent.mechanism === "funded_request",
      );
      expect(requestMatch).toBeDefined();
      // funded_request is the highest-priority mechanism - a real explicit
      // Request is more specific/committed capital than a broad Pool or
      // voluntary direct support.
      expect(item.economicMatch?.recommended).toBe("funded_request");
    });

    it("a campaign funding a different class never matches an unrelated outcome", () => {
      const [item] = attachEconomicMatch(
        [work({ category: "documentation" }), campaign({ category: "security" })],
        { pools: [] },
      );
      expect(
        item.economicMatch?.eligible.some((m) => m.intent.mechanism === "funded_request"),
      ).toBe(false);
    });

    it("draft/non-open campaigns are not treated as public funding demand", () => {
      const [intent] = fundingIntentsFromCampaigns([campaign({ status: "draft" })]);
      expect(intent?.executable).toBe(false);
    });
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
