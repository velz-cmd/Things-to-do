import { describe, expect, it } from "vitest";
import { deriveUserCapabilities } from "../../src/lib/capabilities/user-capabilities";
import { actionMatchesIntent } from "../../src/lib/discover/marketplace/economic-actions";
import type { EconomicActionItem } from "../../src/lib/discover/marketplace/contracts";

function action(overrides: Partial<EconomicActionItem> = {}): EconomicActionItem {
  return {
    id: "economic:person:1",
    subjectType: "contributor",
    subjectId: "person-1",
    headline: "Contributor can receive support",
    happened: "Accepted GitHub work was attributed.",
    whyItMatters: "The person is payout ready.",
    lifecycle: "ready_for_funding",
    audience: "funder",
    source: { provider: "github", label: "owner/repo", stale: false },
    evidenceIds: ["evidence-1"],
    attributionState: "verified",
    fundingReadiness: "ready",
    recipientReadiness: "ready",
    primaryAction: { id: "capital.open_funding", label: "Support with USDC", href: "/discover", enabled: true },
    secondaryActions: [],
    visibility: "public",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("user capabilities", () => {
  it("derives multiple simultaneous capabilities without assigning a fixed role", () => {
    const capabilities = deriveUserCapabilities({
      signedIn: true,
      payoutReady: true,
      identityReady: true,
      sourceConnected: true,
      repositoryAccess: true,
      operatesCommunity: true,
      hasPublishedProgram: true,
      liveSettlementEnabled: true,
    });
    expect(capabilities).toEqual(expect.arrayContaining([
      "can_receive_direct_support",
      "can_claim_work",
      "can_fund_person",
      "can_fund_pool",
      "can_operate_community",
      "can_authorise_distribution",
      "can_manage_payout",
    ]));
  });

  it("keeps unsupported publishing and x402 capabilities inactive", () => {
    const capabilities = deriveUserCapabilities({
      signedIn: true,
      payoutReady: false,
      identityReady: true,
      sourceConnected: true,
      repositoryAccess: true,
      operatesCommunity: false,
      hasPublishedProgram: false,
      liveSettlementEnabled: false,
    });
    expect(capabilities).not.toContain("can_sell_usage");
    expect(capabilities).not.toContain("can_purchase_service");
    expect(capabilities).not.toContain("can_fund_pool");
  });
});

describe("Discover intent", () => {
  it("ranks a payout-ready contributor for Fund without turning intent into a permanent role", () => {
    const item = action();
    expect(actionMatchesIntent(item, "fund")).toBe(true);
    expect(actionMatchesIntent(item, "operate")).toBe(false);
    expect(actionMatchesIntent(item, "explore")).toBe(true);
  });

  it("does not expose publishing or service actions through unrelated records", () => {
    const item = action();
    expect(actionMatchesIntent(item, "publish")).toBe(false);
    expect(actionMatchesIntent(item, "build")).toBe(false);
  });
});
