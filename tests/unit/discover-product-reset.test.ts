import { describe, expect, it } from "vitest";
import {
  amountStateLabel,
  opportunityMatchesView,
  programEntityVisible,
  programPublicationEligible,
} from "../../src/lib/discover/marketplace/publication";
import {
  directSupportPreflight,
  poolFundingPreflight,
} from "../../src/lib/discover/marketplace/funding-preflight";
import { poolFundingHandoff } from "../../src/lib/discover/marketplace/handoffs";
import { selectDiscoverRecommendation } from "../../src/lib/discover/marketplace/recommendation";
import {
  actionMatchesExploreKind,
  buildEconomicActions,
} from "../../src/lib/discover/marketplace/economic-actions";
import type { MarketplaceOpportunity } from "../../src/lib/discover/marketplace/contracts";
import {
  mapPersistedReadinessState,
  withStaleReadiness,
  type WorkspaceReadiness,
} from "../../src/lib/workspace/readiness-contract";

function opportunity(
  overrides: Partial<MarketplaceOpportunity> = {},
): MarketplaceOpportunity {
  return {
    id: "opportunity-1",
    slug: "verified-work",
    title: "Verified repository work",
    summary: "A verified contribution with inspectable evidence.",
    description: "Complete work record.",
    type: "repository_fix",
    status: "open",
    creator: {
      type: "community",
      id: "community-1",
      name: "Open Maintainers",
      verified: true,
    },
    community: { id: "community-1", name: "Open Maintainers" },
    skills: ["TypeScript"],
    deliverables: ["Merged pull request"],
    evidenceRequirements: ["Repository receipt"],
    eligibility: [],
    reward: { amountUsd: 100, token: "USDC", network: "Arc" },
    funding: {
      fundedAmountUsd: 50,
      goalAmountUsd: 100,
      status: "partially_funded",
    },
    provider: { preference: "open" },
    remote: true,
    publishedAt: "2026-07-20T00:00:00.000Z",
    updatedAt: "2026-07-21T00:00:00.000Z",
    verificationStatus: "verified",
    riskFlags: [],
    source: { type: "repository_snapshot", id: "snapshot-1" },
    ...overrides,
  };
}

function readiness(
  overrides: Partial<WorkspaceReadiness> = {},
): WorkspaceReadiness {
  const resource = {
    state: "connected" as const,
    label: "Connected",
    account: "@ada",
    lastSuccessfulAt: "2026-07-21T00:00:00.000Z",
    errorCode: null,
  };
  return {
    schemaVersion: 1,
    userId: "user-1",
    computedAt: "2026-07-21T00:00:00.000Z",
    lastSuccessfulAt: "2026-07-21T00:00:00.000Z",
    stale: false,
    failure: null,
    user: { email: "ada@example.com", displayName: "Ada" },
    identities: { github: resource, verifiedCount: 1 },
    github: {
      personal: resource,
      repositoryAccess: resource,
      repositorySync: resource,
    },
    sources: [],
    communities: [],
    programs: [],
    wallets: {
      app: { state: "connected", address: "0x1111111111111111111111111111111111111111", selected: true },
      connected: { state: "not_configured", address: null, selected: false },
      selectedKind: "app",
      selectedAddress: "0x1111111111111111111111111111111111111111",
      payout: {
        ...resource,
        account: "0x1111...1111",
        address: "0x1111111111111111111111111111111111111111",
        network: "arc-testnet",
      },
      lastConfirmedBalanceMicroUsdc: "1000000",
      lastConfirmedBalanceAt: "2026-07-21T00:00:00.000Z",
    },
    capital: {
      state: "connected",
      pendingAuthorizations: 0,
      claimableRecords: 0,
    },
    capabilities: ["github", "payout"],
    ...overrides,
  };
}

describe("Discover publication policy", () => {
  it("publishes only approved programs with provenance, policy, treasury, and version", () => {
    const base = {
      templateId: "docs-grant",
      status: "active",
      missionId: "mission-1",
      budgetUsd: 100,
      rulesJson: JSON.stringify({ connectorId: "github" }),
      metadataJson: JSON.stringify({
        visibility: "public",
        publicationStatus: "approved",
        publicationVersion: "1",
        provenance: "operator_created",
        policyStatus: "active",
        treasuryAddress: "0x1111111111111111111111111111111111111111",
      }),
    };
    expect(programPublicationEligible(base)).toBe(true);
    expect(
      programPublicationEligible({
        ...base,
        templateId: "media-royalty",
      }),
    ).toBe(false);
    expect(
      programPublicationEligible({
        ...base,
        metadataJson: JSON.stringify({
          visibility: "public",
          publicationStatus: "approved",
          publicationVersion: "1",
          provenance: "operator_created",
          policyStatus: "active",
          treasuryAddress: "0x1111111111111111111111111111111111111111",
          isDemo: true,
        }),
      }),
    ).toBe(false);
    expect(
      programPublicationEligible({
        ...base,
        templateId: "custom",
        metadataJson: JSON.stringify({
          visibility: "public",
          publicationStatus: "approved",
          publicationVersion: "1",
          provenance: "external_integration",
          policyStatus: "active",
          treasuryAddress: "0x1111111111111111111111111111111111111111",
          repository: "owner/repository",
        }),
      }),
    ).toBe(true);
    expect(
      programPublicationEligible({
        ...base,
        metadataJson: JSON.stringify({
          visibility: "public",
          publicationStatus: "approved",
          provenance: "unknown_provenance",
        }),
      }),
    ).toBe(false);
  });

  it("keeps a real legacy GitHub program visible while financial setup remains incomplete", () => {
    const base = {
      templateId: "docs-bounty",
      status: "active",
      missionId: "mission-1",
      budgetUsd: 2000,
      rulesJson: JSON.stringify({ connectorId: "github", eventType: "docs.merged" }),
      metadataJson: JSON.stringify({
        provenance: "operator_created",
        publicationStatus: "legacy_active",
      }),
      user: {
        id: "user-1",
        displayName: "Ada",
        githubUsername: "ada",
        githubId: "123",
      },
      install: { communitySlug: "open-writers", status: "active" },
    };
    expect(programEntityVisible(base)).toBe(true);
    expect(programPublicationEligible(base)).toBe(false);
    expect(
      programEntityVisible({
        ...base,
        rulesJson: JSON.stringify({ connectorId: "navidrome" }),
      }),
    ).toBe(false);
  });

  it("keeps source records available to the projection and limits Outcomes to receipts", () => {
    const work = opportunity();
    expect(opportunityMatchesView(work, "explore")).toBe(true);
    expect(opportunityMatchesView(work, "activity")).toBe(true);
    expect(opportunityMatchesView(work, "outcomes")).toBe(false);
    expect(
      opportunityMatchesView(
        opportunity({ source: { type: "confirmed_receipt", id: "receipt-1" } }),
        "outcomes",
      ),
    ).toBe(true);
  });

  it("derives one canonical action with an exact policy setup handoff", () => {
    const actions = buildEconomicActions({
      opportunities: [opportunity({
        source: { type: "community_program", id: "program-1" },
        pool: { id: "program-1", name: "Docs Pool" },
        creator: { type: "community", id: "user-1", name: "Ada", verified: true },
        entityState: {
          provenance: "operator_created",
          lifecycle: "published",
          financialReadiness: "setup_required",
          blocker: "No active operating policy exists for this program.",
        },
      })],
      people: [],
      communities: [],
      pools: [],
      myCommunities: [],
      viewerUserId: "user-1",
    });
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      subjectType: "policy_blocker",
      lifecycle: "policy_required",
      primaryAction: { label: "Design policy" },
    });
    expect(actions[0]?.primaryAction.href).toContain("step=policy");
    expect(actionMatchesExploreKind(actions[0]!, "programs")).toBe(true);
    expect(actionMatchesExploreKind(actions[0]!, "pools")).toBe(false);
  });

  it("deduplicates repeated legacy program projections and hides unavailable payment actions", () => {
    const repeated = opportunity({
      source: { type: "community_program", id: "program-2" },
      id: "opportunity-2",
      creator: { type: "community", id: "user-2", name: "Second operator", verified: true },
      entityState: {
        provenance: "legacy_operator_record",
        lifecycle: "configured",
        financialReadiness: "setup_required",
        blocker: "No active operating policy exists for this program.",
      },
    });
    const actions = buildEconomicActions({
      opportunities: [
        repeated,
        { ...repeated, id: "opportunity-3", source: { type: "community_program", id: "program-3" } },
      ],
      people: [{
        id: "person-1",
        name: "Contributor",
        kind: "human",
        verifiedIdentities: ["GitHub identity verified"],
        skills: ["GitHub"],
        communities: [],
        acceptsDirectFunding: false,
        acceptsInvitations: true,
        identityState: "profile_claimed",
        payoutReadiness: "setup_required",
        blocker: "No verified payout destination is recorded.",
        primaryAction: {
          id: "discover.open_repository",
          label: "View GitHub profile",
          href: "https://github.com/contributor",
          enabled: true,
        },
        secondaryActions: [],
      }],
      communities: [],
      pools: [],
      myCommunities: [],
    });
    expect(actions.filter((item) => item.subjectType === "policy_blocker")).toHaveLength(1);
    const contributor = actions.find((item) => item.subjectId === "person-1");
    expect(contributor?.primaryAction.label).toBe("View GitHub profile");
    expect(contributor?.fundingReadiness).toBe("blocked");
  });

  it("uses explicit amount-state labels", () => {
    expect(amountStateLabel("modelled_estimate")).toBe("Modelled estimate");
    expect(amountStateLabel("confirmed")).toBe("Confirmed");
  });
});

describe("Workspace readiness consistency", () => {
  it("maps persisted provider states without inventing a disconnected state", () => {
    expect(mapPersistedReadinessState({ configured: false })).toBe("not_configured");
    expect(
      mapPersistedReadinessState({ configured: true, status: "syncing" }),
    ).toBe("syncing");
    expect(
      mapPersistedReadinessState({
        configured: true,
        status: "unknown-provider-state",
        lastSuccessfulAt: "2026-07-20T00:00:00.000Z",
      }),
    ).toBe("stale");
    expect(
      mapPersistedReadinessState({ configured: true, status: "forbidden" }),
    ).toBe("permission_missing");
  });

  it("preserves last-known values and marks connected resources stale after a refresh failure", () => {
    const result = withStaleReadiness(readiness(), {
      code: "READINESS_REFRESH_FAILED",
      correlationId: "request-1",
      occurredAt: "2026-07-22T00:00:00.000Z",
    });
    expect(result.stale).toBe(true);
    expect(result.github.personal.state).toBe("stale");
    expect(result.wallets.selectedAddress).toBe(
      "0x1111111111111111111111111111111111111111",
    );
    expect(result.wallets.lastConfirmedBalanceMicroUsdc).toBe("1000000");
  });

  it("recommends payout completion when GitHub is connected but settlement is not ready", () => {
    const notReady = readiness({
      wallets: {
        ...readiness().wallets,
        payout: {
          ...readiness().wallets.payout,
          state: "not_configured",
          account: null,
          address: null,
        },
      },
    });
    const result = selectDiscoverRecommendation(notReady, []);
    expect(result.id).toBe("complete-payout");
    expect(result.primaryAction.href).toContain("/profile");
  });
});

describe("Funding preflight", () => {
  it("preserves the exact Pool and Discover return path in the Capital handoff", () => {
    expect(
      poolFundingHandoff(
        "program-1",
        "/discover?view=explore&kind=pools&pool=program%3A1",
      ),
    ).toBe(
      "/capital?intent=back-pool&programId=program-1&returnTo=%2Fdiscover%3Fview%3Dexplore%26kind%3Dpools%26pool%3Dprogram%253A1",
    );
    expect(poolFundingHandoff("program-1", "https://example.com")).toBe(
      "/capital?intent=back-pool&programId=program-1",
    );
  });

  it("blocks direct support until payout and explicit authorization are ready", () => {
    const base = {
      recipientVerified: true,
      payoutReady: false,
      network: "arc-testnet",
      asset: "USDC",
      amountMicroUsdc: 500_000n,
      balanceMicroUsdc: 1_000_000n,
      spendingLimitMicroUsdc: 1_000_000n,
      feeMicroUsdc: 1_000n,
      idempotencyKey: "support-1",
      authorized: false,
    };
    expect(directSupportPreflight(base)).toEqual({
      ok: false,
      blocker: "payout_not_ready",
    });
    expect(
      directSupportPreflight({
        ...base,
        payoutReady: true,
      }),
    ).toEqual({ ok: false, blocker: "not_authorized" });
    expect(
      directSupportPreflight({
        ...base,
        payoutReady: true,
        authorized: true,
      }),
    ).toMatchObject({
      ok: true,
      totalMicroUsdc: 501_000n,
    });
  });

  it("blocks Pool funding when policy or allocation state is incomplete", () => {
    expect(
      poolFundingPreflight({
        poolPublished: true,
        policyActive: false,
        allocationLocked: true,
        amountMicroUsdc: 100_000n,
        balanceMicroUsdc: 1_000_000n,
        idempotencyKey: "pool-1",
        authorized: true,
      }),
    ).toEqual({ ok: false, blocker: "pool_not_ready" });
  });
});
