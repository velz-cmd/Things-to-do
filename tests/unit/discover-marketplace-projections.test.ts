import { describe, expect, it } from "vitest";
import type {
  DiscoverAction,
  DiscoverActivityItem,
  DiscoverCommunity,
  DiscoverInboxItem,
  DiscoverPerson,
  DiscoverPool,
  MarketplaceOpportunity,
} from "../../src/lib/discover/marketplace/contracts";
import { programMarketplaceKind } from "../../src/lib/discover/marketplace/normalize";
import {
  buildDiscoverProjection,
  isConfirmedOutcome,
} from "../../src/lib/discover/marketplace/projections";

const detailsAction: DiscoverAction = {
  id: "discover.open_record",
  label: "View details",
  href: "/discover",
  enabled: true,
  presentation: {
    kind: "workbench",
    target: {
      panel: "entity_details",
      subjectId: "item-1",
      entityType: "program",
    },
  },
};

function opportunity(
  overrides: Partial<MarketplaceOpportunity> = {},
): MarketplaceOpportunity {
  return {
    id: "item-1",
    slug: "item-1",
    title: "Documentation Program",
    summary: "Rewards accepted documentation work.",
    description: "A published Program with inspectable rules.",
    type: "grant",
    status: "open",
    creator: {
      type: "community",
      id: "owner-1",
      name: "Open Writers",
      verified: true,
    },
    community: { id: "writers", name: "Open Writers" },
    skills: [],
    deliverables: [],
    evidenceRequirements: [],
    eligibility: [],
    provider: { preference: "open" },
    publishedAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-02T00:00:00.000Z",
    verificationStatus: "verified",
    riskFlags: [],
    source: { type: "community_program", id: "program-1" },
    marketplaceKind: "program",
    primaryAction: detailsAction,
    ...overrides,
  };
}

const person: DiscoverPerson = {
  id: "person-1",
  name: "Ada",
  kind: "maintainer",
  verifiedIdentities: ["github"],
  skills: ["TypeScript"],
  communities: ["Open Writers"],
  acceptsDirectFunding: true,
  acceptsInvitations: true,
  identityState: "identity_verified",
  payoutReadiness: "ready",
  primaryAction: {
    ...detailsAction,
    presentation: {
      kind: "workbench",
      target: {
        panel: "direct_support",
        subjectId: "person-1",
        recipientUserId: "person-1",
        recipientLabel: "Ada",
      },
    },
  },
  secondaryActions: [],
};

const pool: DiscoverPool = {
  id: "pool-1",
  name: "Documentation Pool",
  owner: "Open Writers",
  communitySlug: "writers",
  purpose: "Fund accepted documentation work.",
  type: "quadratic-funding",
  balanceUsd: 250,
  targetUsd: 1000,
  token: "USDC",
  network: "Arc",
  eligibleOpportunityTypes: ["grant"],
  lifecycleState: "accepting_funding",
  publicationState: "approved",
  policyState: "active",
  treasuryReadiness: "ready",
  primaryAction: {
    ...detailsAction,
    presentation: {
      kind: "workbench",
      target: {
        panel: "pool_funding",
        subjectId: "pool-1",
        programId: "pool-1",
        communitySlug: "writers",
        poolName: "Documentation Pool",
      },
    },
  },
  secondaryActions: [],
};

const community: DiscoverCommunity = {
  id: "community-1",
  slug: "writers",
  name: "Open Writers",
  purpose: "Fund and verify public documentation.",
  type: "open source",
  verified: true,
};

const inboxItem: DiscoverInboxItem = {
  id: "inbox-1",
  audience: "contributor",
  title: "Choose a payout destination",
  why: "Your verified work needs a destination before it can be paid.",
  state: "identity_required",
  blocker: "No payout destination is selected.",
  primaryAction: {
    ...detailsAction,
    presentation: {
      kind: "workbench",
      target: { panel: "payout_destination", subjectId: "person-1" },
    },
  },
  secondaryActions: [],
};

const activity: DiscoverActivityItem = {
  id: "activity-1",
  kind: "funding",
  title: "Funding prepared",
  description: "A Pool contribution is ready to confirm.",
  state: "prepared",
  occurredAt: "2026-08-03T00:00:00.000Z",
};

function baseInput() {
  return {
    category: "all" as const,
    inbox: [inboxItem],
    people: [person],
    pools: [pool],
    communities: [community],
    opportunities: [
      opportunity(),
      opportunity({
        id: "work-1",
        source: { type: "github_evidence", id: "evidence-1" },
        marketplaceKind: "verified_work",
      }),
    ],
    activity: [activity],
  };
}

describe("Discover marketplace projections", () => {
  it("keeps For You personal and excludes public inventory from the attention list", () => {
    const projection = buildDiscoverProjection({
      ...baseInput(),
      view: "for_you",
    });

    expect(projection.kind).toBe("for_you");
    if (projection.kind !== "for_you") return;
    expect(projection.recommendation?.id).toBe("inbox-1");
    expect(projection.attention).toEqual([]);
    expect(projection.pools.map((item) => item.id)).toEqual(["pool-1"]);
    expect(projection.people.map((item) => item.id)).toEqual(["person-1"]);
    expect(projection.inProgress.map((item) => item.id)).toEqual(["activity-1"]);
  });

  it("projects Explore into separate marketplace domains without treating Programs as Pools", () => {
    const projection = buildDiscoverProjection({
      ...baseInput(),
      view: "explore",
    });

    expect(projection.kind).toBe("explore");
    if (projection.kind !== "explore") return;
    expect(projection.people).toHaveLength(1);
    expect(projection.work.map((item) => item.id)).toEqual(["work-1"]);
    expect(projection.programs.map((item) => item.id)).toEqual(["item-1"]);
    expect(projection.pools.map((item) => item.id)).toEqual(["pool-1"]);
    expect(projection.communities).toHaveLength(1);
  });

  it("keeps My Activity limited to the supplied personal ledger", () => {
    const projection = buildDiscoverProjection({
      ...baseInput(),
      view: "activity",
    });

    expect(projection.kind).toBe("activity");
    if (projection.kind !== "activity") return;
    expect(projection.items).toEqual([activity]);
    expect(projection.summary).toMatchObject({ funding: 1, in_progress: 1 });
  });

  it("shows Outcomes only when a confirmed receipt opens in the receipt Workbench", () => {
    const receipt = opportunity({
      id: "receipt-1",
      marketplaceKind: "outcome",
      source: { type: "confirmed_receipt", id: "receipt-1" },
      entityState: {
        provenance: "canonical_record",
        lifecycle: "confirmed",
        financialReadiness: "confirmed",
      },
      primaryAction: {
        ...detailsAction,
        presentation: {
          kind: "workbench",
          target: {
            panel: "receipt",
            subjectId: "receipt-1",
            receiptUrl: "/receipt/receipt-1",
          },
        },
      },
    });
    const unproven = opportunity({
      id: "target-1",
      marketplaceKind: "outcome",
      source: { type: "community_program", id: "program-2" },
    });
    expect(isConfirmedOutcome(receipt)).toBe(true);
    expect(isConfirmedOutcome(unproven)).toBe(false);

    const projection = buildDiscoverProjection({
      ...baseInput(),
      view: "outcomes",
      opportunities: [unproven, receipt],
    });
    expect(projection.kind).toBe("outcomes");
    if (projection.kind !== "outcomes") return;
    expect(projection.items.map((item) => item.id)).toEqual(["receipt-1"]);
  });
});

describe("Discover Program and Pool classification", () => {
  it("uses explicit marketplace metadata and a narrow Pool template allowlist", () => {
    expect(programMarketplaceKind("security-fund", {})).toBe("pool");
    expect(programMarketplaceKind("docs-grant", {})).toBe("program");
    expect(
      programMarketplaceKind("docs-grant", { marketplaceKind: "pool" }),
    ).toBe("pool");
    expect(
      programMarketplaceKind("security-fund", { marketplaceKind: "program" }),
    ).toBe("program");
  });
});
