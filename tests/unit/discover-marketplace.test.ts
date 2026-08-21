import { describe, expect, it } from "vitest";
import {
  normalizePersistedOpportunity,
  normalizeProgramOpportunity,
  type PersistedOpportunityRow,
  type ProgramOpportunityRow,
} from "../../src/lib/discover/marketplace/normalize";
import {
  parseDiscoverView,
  parseOpportunityFilters,
} from "../../src/lib/discover/marketplace/filters";
import {
  collectMarketplaceSourceResults,
  attachRequestActions,
  attachVerifiedWorkActions,
  confirmedFundingUsd,
  deduplicateMarketplaceOpportunities,
  listPools,
  marketplaceOpportunityMatches,
  mergeAttributedDiscoverPeople,
  paginateMarketplaceOpportunities,
  sortMarketplaceOpportunities,
} from "../../src/lib/discover/marketplace/query";
import { importedOpportunitySchema } from "../../src/lib/discover/marketplace/import";
import {
  DISCOVER_ROUTE_TO_VIEW,
  DISCOVER_ROUTE_VIEWS,
  DISCOVER_VIEW_TO_ROUTE,
  DISCOVER_VIEWS,
  type MarketplaceOpportunity,
} from "../../src/lib/discover/marketplace/contracts";
import {
  normalizeConfirmedOutcomes,
  normalizeGithubAcceptedWork,
} from "../../src/lib/discover/marketplace/read-model";
import type { FundingOpportunity } from "../../src/lib/github/types";
import { discoverRequestCommandSchema } from "../../src/lib/discover/request-contract";

function program(overrides: Partial<ProgramOpportunityRow> = {}): ProgramOpportunityRow {
  return {
    id: "program-1",
    name: "Documentation grant",
    templateId: "docs-grant",
    status: "active",
    budgetUsd: 500,
    rulesJson: JSON.stringify({
      evidenceRequirements: ["Merged documentation pull request"],
    }),
    metadataJson: JSON.stringify({
      summary: "Fund verified documentation improvements.",
      category: "Documentation",
      skills: ["technical writing", "TypeScript"],
      remote: true,
      providerPreference: "open",
    }),
    missionId: "mission-1",
    lastDeployAt: new Date("2026-07-20T00:00:00.000Z"),
    createdAt: new Date("2026-07-19T00:00:00.000Z"),
    updatedAt: new Date("2026-07-21T00:00:00.000Z"),
    user: {
      id: "user-1",
      displayName: "Ada",
      githubUsername: "ada",
      githubId: "123",
    },
    install: { communitySlug: "open-writers", status: "active" },
    fundStakes: [{ principalUsd: 200, releasedUsd: 0, status: "active" }],
    ...overrides,
  };
}

function opportunity(overrides: Partial<MarketplaceOpportunity> = {}): MarketplaceOpportunity {
  return {
    id: "opp-1",
    slug: "docs-grant-a1",
    title: "Documentation grant",
    summary: "Fund verified documentation improvements.",
    description: "Ship a complete guide with evidence.",
    type: "grant",
    status: "open",
    creator: {
      type: "community",
      id: "user-1",
      name: "Ada",
      verified: true,
    },
    community: { id: "open-writers", name: "Open Writers" },
    skills: ["technical writing", "TypeScript"],
    deliverables: ["Guide"],
    evidenceRequirements: ["Merged pull request"],
    eligibility: [],
    reward: { amountUsd: 500, token: "USDC", network: "Arc" },
    funding: {
      fundedAmountUsd: 200,
      goalAmountUsd: 500,
      status: "partially_funded",
    },
    provider: { preference: "open" },
    remote: true,
    publishedAt: "2026-07-20T00:00:00.000Z",
    updatedAt: "2026-07-21T00:00:00.000Z",
    verificationStatus: "configured",
    riskFlags: [],
    source: { type: "community_program", id: "program-1" },
    ...overrides,
  };
}

describe("Discover marketplace normalisation", () => {
  it("maps a community program into the canonical opportunity contract", () => {
    const result = normalizeProgramOpportunity(program());
    expect(result).toMatchObject({
      marketplaceKind: "program",
      type: "grant",
      creator: { id: "user-1", name: "Ada", verified: true },
      community: { id: "open-writers", name: "Open Writers" },
      reward: { amountUsd: 500, token: "USDC" },
      funding: {
        fundedAmountUsd: undefined,
        pendingAmountUsd: 200,
        goalAmountUsd: 500,
        status: "partially_funded",
      },
      remote: true,
      skills: ["technical writing", "TypeScript"],
      evidenceRequirements: ["Merged documentation pull request"],
    });
    expect(result.slug).toMatch(/^documentation-grant-[a-f0-9]{10}$/);
  });

  it("opens a ready Program in Discover without presenting it as a Pool", () => {
    const result = normalizeProgramOpportunity(program({
      metadataJson: JSON.stringify({
        publicationStatus: "approved",
        policyStatus: "active",
        treasuryAddress: "0x0000000000000000000000000000000000000001",
      }),
    }));

    expect(result.marketplaceKind).toBe("program");
    expect(result.pool).toBeUndefined();
    expect(result.primaryAction).toMatchObject({
      label: "View Program",
      presentation: {
        kind: "workbench",
        target: { panel: "entity_details", entityType: "program" },
      },
    });
  });

  it("keeps Pool templates fundable while preserving their canonical type", () => {
    const result = normalizeProgramOpportunity(program({
      templateId: "security-fund",
      metadataJson: JSON.stringify({
        publicationStatus: "approved",
        policyStatus: "active",
        treasuryAddress: "0x0000000000000000000000000000000000000001",
      }),
    }));

    expect(result.marketplaceKind).toBe("pool");
    expect(result.pool?.id).toBe("program-1");
    expect(result.primaryAction).toMatchObject({
      label: "Fund Pool",
      presentation: {
        kind: "workbench",
        target: { panel: "pool_funding" },
      },
    });
  });

  it("gives the Pool operator a Review distribution action once the Pool is financially ready, but not other viewers", () => {
    const readyPool = normalizeProgramOpportunity(program({
      templateId: "security-fund",
      metadataJson: JSON.stringify({
        publicationStatus: "approved",
        policyStatus: "active",
        treasuryAddress: "0x0000000000000000000000000000000000000001",
      }),
    }));

    const asOperator = listPools([readyPool], "user-1");
    expect(asOperator[0]?.secondaryActions).toContainEqual(
      expect.objectContaining({
        label: "Review distribution",
        presentation: expect.objectContaining({
          kind: "workbench",
          target: expect.objectContaining({
            panel: "pool_distribution",
            communitySlug: "open-writers",
            programId: "program-1",
          }),
        }),
      }),
    );

    const asOtherViewer = listPools([readyPool], "someone-else");
    expect(
      asOtherViewer[0]?.secondaryActions.some(
        (action) =>
          action.presentation.kind === "workbench" &&
          action.presentation.target.panel === "pool_distribution",
      ),
    ).toBe(false);

    const setupIncompletePool = normalizeProgramOpportunity(program({
      templateId: "security-fund",
    }));
    const operatorOfIncompletePool = listPools([setupIncompletePool], "user-1");
    expect(
      operatorOfIncompletePool[0]?.secondaryActions.some(
        (action) =>
          action.presentation.kind === "workbench" &&
          action.presentation.target.panel === "pool_distribution",
      ),
    ).toBe(false);
  });

  it("keeps selected provider state distinct from open applications", () => {
    const row: PersistedOpportunityRow = {
      id: "canonical-1",
      slug: "selected-task",
      title: "Selected task",
      summary: "A selected provider task.",
      description: "The complete task description.",
      type: "task",
      status: "open",
      creatorType: "founder",
      creatorId: "owner-1",
      creatorName: "Founder",
      creatorAvatar: null,
      communityId: null,
      communityName: null,
      poolId: null,
      poolName: null,
      projectId: null,
      repository: null,
      category: null,
      skills: [],
      deliverables: [],
      evidenceRequirements: [],
      eligibility: [],
      rewardAmountUsd: 100,
      rewardToken: "USDC",
      rewardNetwork: "Arc",
      fundedAmountUsd: 100,
      fundingGoalUsd: 100,
      fundingStatus: "funded",
      paymentMode: "milestone",
      distributionMethod: null,
      preferredProviderId: null,
      preferredProviderName: null,
      selectedProviderId: "provider-1",
      selectedProviderName: "RepoDiet Agent",
      applicationCount: 2,
      capacity: 1,
      deadline: null,
      location: null,
      remote: true,
      estimatedDelivery: null,
      sourceType: "admin",
      sourceId: "admin-1",
      verificationStatus: "verified",
      riskFlags: [],
      publishedAt: new Date("2026-07-20T00:00:00.000Z"),
      updatedAt: new Date("2026-07-21T00:00:00.000Z"),
    };
    expect(normalizePersistedOpportunity(row).provider).toEqual({
      preference: "selected",
      selected: { id: "provider-1", name: "RepoDiet Agent" },
    });
  });
});

describe("Discover marketplace URL state and pagination", () => {
  it("parses only supported views and filters", () => {
    expect(parseDiscoverView("communities")).toBe("activity");
    expect(parseDiscoverView("my_communities")).toBe("activity");
    expect(parseDiscoverView("programs")).toBe("explore");
    expect(parseDiscoverView("people")).toBe("explore");
    expect(parseDiscoverView("work")).toBe("explore");
    expect(parseDiscoverView("pools")).toBe("activity");
    expect(parseDiscoverView("verified_work")).toBe("for_you");
    expect(parseDiscoverView("requests")).toBe("explore");
    expect(parseDiscoverView("agents")).toBe("agents");
    expect(parseDiscoverView("agent_marketplace")).toBe("agents");
    expect(parseDiscoverView("opportunities")).toBe("for_you");
    expect(parseDiscoverView("saved")).toBe("for_you");
    expect(parseDiscoverView("unknown")).toBe("for_you");
    // The canonical route id "activity" means the Activity ledger, even
    // though the internal DiscoverView id "activity" separately means
    // Pools - the two share a string by coincidence, not meaning.
    expect(parseDiscoverView("activity")).toBe("outcomes");
  });

  it("resolves every canonical DiscoverRouteView to a distinct, correct DiscoverView - the exact case a hand-duplicated alias table let collide", () => {
    expect(parseDiscoverView("verified_work")).toBe("for_you");
    expect(parseDiscoverView("requests")).toBe("explore");
    expect(parseDiscoverView("pools")).toBe("activity");
    expect(parseDiscoverView("agents")).toBe("agents");
    expect(parseDiscoverView("activity")).toBe("outcomes");
    const resolved = new Set(
      ["verified_work", "requests", "pools", "agents", "activity"].map(parseDiscoverView),
    );
    expect(resolved.size).toBe(5);
  });

  it("keeps the route<->view serializer and parser as exact inverses, for every surface", () => {
    for (const route of DISCOVER_ROUTE_VIEWS) {
      const view = DISCOVER_ROUTE_TO_VIEW[route];
      expect(DISCOVER_VIEW_TO_ROUTE[view]).toBe(route);
      expect(parseDiscoverView(route)).toBe(view);
    }
    for (const view of DISCOVER_VIEWS) {
      const route = DISCOVER_VIEW_TO_ROUTE[view];
      expect(DISCOVER_ROUTE_TO_VIEW[route]).toBe(view);
    }
  });

  it("parses opportunity filters from search params", () => {
    expect(
      parseOpportunityFilters({
        q: "typescript",
        type: "bounty",
        funding: "funded",
        provider: "preferred",
        remote: "true",
        minReward: "100",
        sort: "closing_soon",
        view: "work",
        repository: "owner/project",
        intent: "fund",
      }),
    ).toMatchObject({
      q: "typescript",
      type: "bounty",
      fundingStatus: "funded",
      provider: "preferred",
      remote: true,
      minReward: 100,
      sort: "closing_soon",
      kind: "work",
      repository: "owner/project",
      intent: "fund",
    });
  });

  it("reports confirmed funding only from authoritative micro-USDC totals", () => {
    expect(confirmedFundingUsd(null)).toBeUndefined();
    expect(confirmedFundingUsd(0n)).toBeUndefined();
    expect(confirmedFundingUsd(12_500_000n)).toBe(12.5);
  });

  it("filters by public facts and uses a stable cursor without duplicates", () => {
    const items = [
      opportunity({ id: "1", slug: "one" }),
      opportunity({ id: "2", slug: "two", type: "bounty" }),
      opportunity({ id: "3", slug: "three", reward: { amountUsd: 50 } }),
    ];
    expect(marketplaceOpportunityMatches(items[0], { q: "typescript", sort: "newest" })).toBe(true);
    expect(marketplaceOpportunityMatches(items[0], { type: "bounty", sort: "newest" })).toBe(false);
    const first = paginateMarketplaceOpportunities(items, undefined, 2);
    const second = paginateMarketplaceOpportunities(items, first.nextCursor ?? undefined, 2);
    expect(first.items.map((item) => item.id)).toEqual(["1", "2"]);
    expect(second.items.map((item) => item.id)).toEqual(["3"]);
    expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(3);
  });

  it("deduplicates source records and sorts closing deadlines deterministically", () => {
    const duplicate = opportunity({ id: "copy", slug: "copy" });
    const unique = deduplicateMarketplaceOpportunities([
      opportunity(),
      duplicate,
      opportunity({
        id: "other",
        slug: "other",
        source: { type: "admin", id: "other" },
        deadline: "2026-08-01T00:00:00.000Z",
      }),
    ]);
    expect(unique).toHaveLength(2);
    expect(sortMarketplaceOpportunities(unique, { sort: "closing_soon" })[0].id).toBe("other");
  });
});

describe("Discover source isolation and import validation", () => {
  it("keeps successful source results when another source fails", () => {
    const result = collectMarketplaceSourceResults(
      ["admin", "community"],
      [
        { status: "fulfilled", value: [opportunity()] },
        { status: "rejected", reason: new Error("Source timed out after 4000ms") },
      ],
      "request-1",
    );
    expect(result.items).toHaveLength(1);
    expect(result.failures).toEqual([
      expect.objectContaining({
        source: "community",
        requestId: "request-1",
        retryable: true,
      }),
    ]);
  });

  it("rejects public records without publication dates and contradictory funding", () => {
    const base = {
      sourceRecordId: "admin-1",
      title: "Verified documentation bounty",
      summary: "Publish a complete guide for the community.",
      description: "Deliver and verify a complete technical guide for the public community.",
      type: "bounty" as const,
      status: "published" as const,
      visibility: "public" as const,
      creatorType: "community" as const,
      creatorName: "Open Writers",
      fundedAmountUsd: 10,
      fundingGoalUsd: 100,
      fundingStatus: "funded" as const,
    };
    const invalid = importedOpportunitySchema.safeParse(base);
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.error.issues.map((issue) => issue.path.join("."))).toEqual(
        expect.arrayContaining(["publishedAt", "fundingStatus"]),
      );
    }
    expect(
      importedOpportunitySchema.safeParse({
        ...base,
        fundingStatus: "partially_funded",
        publishedAt: "2026-07-20T00:00:00.000Z",
        expiresAt: "2026-07-19T00:00:00.000Z",
      }).success,
    ).toBe(false);
  });
});

describe("Discover canonical projections", () => {
  it("publishes accepted GitHub work without inventing an amount", () => {
    const repository: FundingOpportunity = {
      id: "repo-1",
      owner: "owner",
      repo: "project",
      fullName: "owner/project",
      stars: 10,
      forks: 2,
      health: {
        score: 80,
        grade: "B",
        signals: [],
        maintainerCount: 1,
        fundingGapUsd: 0,
        headline: "Healthy",
      },
      unfundedMaintainers: 0,
      highImpactPrs: 1,
      headline: "One accepted contribution",
      priority: "medium",
      live: true,
      activity: {
        observedAt: "2026-07-21T00:00:00.000Z",
        rangeStart: null,
        rangeEnd: "2026-07-21T00:00:00.000Z",
        counts: {
          code: 1,
          review: 0,
          documentation: 0,
          issue_resolution: 0,
          release_work: 0,
          support: 0,
          security: 0,
        },
        contributors: [],
        records: [
          {
            id: "42",
            category: "code",
            title: "Merge pull request #42",
            actor: "ada",
            occurredAt: "2026-07-20T00:00:00.000Z",
            sourceUrl: "https://github.com/owner/project/pull/42",
            sourceKind: "pull_request",
          },
        ],
      },
    };
    const result = normalizeGithubAcceptedWork([repository], [{
      id: "evidence-42",
      externalId: "42",
      subjectRef: "github:owner/project",
      kind: "github.pull_request.code",
      sourceUrl: "https://github.com/owner/project/pull/42",
    }]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      repository: "owner/project",
      verificationStatus: "verified_evidence_no_funding_rule",
      entityState: {
        financialReadiness: "setup_required",
      },
      primaryAction: { label: "View proof" },
    });
    expect(result[0]?.reward).toBeUndefined();
    expect(result[0]?.primaryAction).toMatchObject({
      presentation: {
        target: { panel: "evidence", evidenceIds: ["evidence-42"] },
      },
    });
    expect(mergeAttributedDiscoverPeople([], result)).toEqual([
      expect.objectContaining({
        id: "github-actor:ada",
        name: "ada",
        completedWork: 1,
        identityState: "unclaimed_contributor",
        payoutReadiness: "invite_to_claim",
        acceptsDirectFunding: false,
        primaryAction: expect.objectContaining({
          label: "View GitHub profile",
          href: "https://github.com/ada",
          enabled: true,
          id: "discover.open_repository",
          presentation: expect.objectContaining({ kind: "navigation", target: "external" }),
        }),
      }),
    ]);

    const claimedPerson = {
      ...mergeAttributedDiscoverPeople([], result)[0]!,
      id: "recipient-1",
      name: "Ada Lovelace",
      profilePath: "https://github.com/ada",
      identityState: "work_attribution_verified" as const,
      payoutReadiness: "ready" as const,
      acceptsDirectFunding: true,
    };
    const payable = attachVerifiedWorkActions(result, [claimedPerson], "funder-1", true);
    expect(payable[0]).toMatchObject({
      creator: { id: "recipient-1" },
      entityState: { financialReadiness: "ready", blocker: undefined },
      primaryAction: {
        id: "discover.fund_verified_work",
        label: "Support this work",
        requiresConfirmation: true,
        presentation: {
          kind: "workbench",
          target: {
            panel: "work_funding",
            recipientUserId: "recipient-1",
            repository: "owner/project",
          },
        },
      },
    });
    const settlementPaused = attachVerifiedWorkActions(
      result,
      [claimedPerson],
      "funder-1",
      false,
    );
    expect(settlementPaused[0]).toMatchObject({
      creator: { id: "recipient-1" },
      primaryAction: {
        id: "discover.fund_verified_work",
        label: "Support this work",
        enabled: false,
        disabledReason: expect.stringContaining("Arc settlement"),
      },
      secondaryActions: [
        expect.objectContaining({ id: "discover.open_evidence" }),
        expect.objectContaining({ id: "discover.run_agent_service" }),
      ],
    });
    const blocked = attachVerifiedWorkActions(result, [claimedPerson], "recipient-1", true);
    expect(blocked[0]).toMatchObject({
      primaryAction: { id: "discover.open_evidence" },
      entityState: { financialReadiness: "setup_required" },
    });
  });

  it("rejects an outcome without both a receipt and Arc explorer reference", () => {
    expect(
      normalizeConfirmedOutcomes([
        {
          id: "receipt-1",
          kind: "settlement",
          title: "$1.00 USDC confirmed on Arc",
          amountUsd: 1,
          status: "confirmed",
          receiptHref: "/outcomes/out_receipt-1",
          at: "2026-07-21T00:00:00.000Z",
        },
      ]),
    ).toEqual([]);
  });
});

describe("Discover Open Request contract", () => {
  const request = opportunity({
    id: "request-1",
    status: "open",
    creator: { type: "founder", id: "owner-1", name: "Requester", verified: true },
    provider: { preference: "open" },
    source: { type: "resolve_request", id: "request-1" },
  });

  it("rejects an unfalsifiable or under-specified request", () => {
    const result = discoverRequestCommandSchema.safeParse({
      action: "create",
      idempotencyKey: "6ebdb39c-912b-4aa9-8d3b-27a9a23c1d2f",
      title: "Fix",
      description: "Do something",
      requestType: "task",
      evidenceRequirement: "PR",
      acceptanceRequirement: "Done",
      budgetUsd: 0,
    });
    expect(result.success).toBe(false);
  });

  it("derives the next request action from ownership and lifecycle", () => {
    expect(attachRequestActions([request], "worker-1")[0].primaryAction).toMatchObject({
      id: "discover.take_request",
      label: "Take request",
      requiresConfirmation: true,
    });
    expect(
      attachRequestActions([{ ...request, status: "under_review" }], "owner-1")[0]
        .primaryAction,
    ).toMatchObject({ id: "discover.review_request", label: "Review submitted work" });
    expect(
      attachRequestActions([{ ...request, status: "approved" }], "owner-1")[0]
        .primaryAction,
    ).toMatchObject({ id: "discover.release_request", label: "Release payment" });
  });
});
