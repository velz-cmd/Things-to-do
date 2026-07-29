import { describe, expect, it } from "vitest";
import {
  amountStateLabel,
  opportunityMatchesView,
  programPublicationEligible,
} from "../../src/lib/discover/marketplace/publication";
import {
  directSupportPreflight,
  poolFundingPreflight,
} from "../../src/lib/discover/marketplace/funding-preflight";
import { selectDiscoverRecommendation } from "../../src/lib/discover/marketplace/recommendation";
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
  it("publishes supported real programs and rejects fixtures or unsupported programs", () => {
    const base = {
      templateId: "docs-grant",
      status: "active",
      missionId: "mission-1",
      budgetUsd: 100,
      metadataJson: JSON.stringify({ visibility: "public" }),
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
        metadataJson: JSON.stringify({ isDemo: true }),
      }),
    ).toBe(false);
    expect(
      programPublicationEligible({
        ...base,
        templateId: "custom",
        metadataJson: JSON.stringify({ repository: "owner/repository" }),
      }),
    ).toBe(true);
  });

  it("separates verified work, Pools, Programs, and Outcomes", () => {
    const work = opportunity();
    expect(opportunityMatchesView(work, "work")).toBe(true);
    expect(opportunityMatchesView(work, "pools")).toBe(false);
    expect(
      opportunityMatchesView(
        opportunity({ pool: { id: "pool-1", name: "Docs Pool" } }),
        "pools",
      ),
    ).toBe(true);
    expect(
      opportunityMatchesView(
        opportunity({ source: { type: "community_program", id: "program-1" } }),
        "programs",
      ),
    ).toBe(true);
    expect(
      opportunityMatchesView(
        opportunity({ source: { type: "outcome_campaign", id: "campaign-1" } }),
        "outcomes",
      ),
    ).toBe(true);
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
