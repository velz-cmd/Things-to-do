import { describe, expect, it } from "vitest";
import { attachVerifiedWorkActions } from "@/lib/discover/marketplace/query";
import {
  moreRestrictiveAction,
  resolveCanonicalAction,
  type CanonicalActionId,
} from "@/lib/discover/marketplace/canonical-action-resolver";
import type { CanonicalEconomicState } from "@/lib/discover/marketplace/economic-state";
import type {
  DiscoverPerson,
  MarketplaceOpportunity,
} from "@/lib/discover/marketplace/contracts";

/**
 * Phase 5 Release Slice 11: shadow-mode parity between the live legacy
 * `attachVerifiedWorkActions()` (query.ts) and the new canonical
 * `resolveCanonicalAction()` (canonical-action-resolver.ts). This file does
 * NOT cut anything over - it proves what each system would independently
 * decide for the same real facts, so every disagreement is investigated
 * here rather than discovered later in production (Release Slice 12 is the
 * safe cutover, gated on this parity record).
 */

function person(overrides: Partial<DiscoverPerson> = {}): DiscoverPerson {
  return {
    id: "person-1",
    name: "Ada",
    kind: "human",
    verifiedIdentities: [],
    skills: [],
    communities: [],
    acceptsDirectFunding: true,
    acceptsInvitations: true,
    identityState: "work_attribution_verified",
    payoutReadiness: "ready",
    primaryAction: { id: "profile.view", label: "View", href: "/", enabled: true, presentation: { kind: "navigation", target: "discover", secondary: false } },
    secondaryActions: [],
    profilePath: "https://github.com/ada-dev",
    ...overrides,
  } as DiscoverPerson;
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
    creator: { type: "person", id: "user-2", name: "@ada-dev", verified: true },
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
    sourceUrl: "https://github.com/example/repo/commit/abc123",
    repository: "example/repo",
    entityState: {
      provenance: "operator_created",
      lifecycle: "published",
      financialReadiness: "ready",
    },
    ...overrides,
  } as MarketplaceOpportunity;
}

function economicState(overrides: Partial<CanonicalEconomicState> = {}): CanonicalEconomicState {
  return {
    state: "funding_available",
    demand: true,
    eligibility: { eligible: true, reason: "eligible" },
    obligation: null,
    coverage: {
      requiredUsd: 100,
      confirmedUsd: 0,
      pendingUsd: 0,
      remainingUsd: 100,
      currency: "USDC",
      records: [],
      fullyCovered: false,
    },
    authorization: { required: false, granted: false },
    payout: "destination_ready",
    settlement: "not_started",
    mechanism: "direct_support",
    provenance: "economic_match",
    nextAction: "fund",
    ...overrides,
  };
}

type ParityRow = {
  name: string;
  people: DiscoverPerson[];
  viewerUserId?: string;
  liveSettlementEnabled: boolean;
  economicState: CanonicalEconomicState | undefined;
  expectedLegacyActionId: string;
  expectedCanonicalActionId: CanonicalActionId;
  expectAgreement: boolean;
};

const rows: ParityRow[] = [
  {
    name: "unclaimed contributor - both systems fall back to evidence-only",
    people: [],
    liveSettlementEnabled: true,
    economicState: economicState({ nextAction: "fund" }),
    expectedLegacyActionId: "discover.open_evidence",
    expectedCanonicalActionId: "discover.open_evidence",
    expectAgreement: true,
  },
  {
    name: "viewer is the attributed recipient, payout not ready - both systems ask them to set a payout destination",
    people: [person({ payoutReadiness: "setup_required" })],
    viewerUserId: "person-1",
    liveSettlementEnabled: true,
    economicState: economicState({ nextAction: "fund" }),
    expectedLegacyActionId: "profile.set_payout_destination",
    expectedCanonicalActionId: "profile.set_payout_destination",
    expectAgreement: true,
  },
  {
    name: "viewer is the attributed recipient, payout ready - self-funding is never offered by either system",
    people: [person({ payoutReadiness: "ready" })],
    viewerUserId: "person-1",
    liveSettlementEnabled: true,
    economicState: economicState({ nextAction: "fund" }),
    expectedLegacyActionId: "discover.open_evidence",
    expectedCanonicalActionId: "discover.open_evidence",
    expectAgreement: true,
  },
  {
    name: "another viewer, recipient ready, live settlement, real fund demand - both systems agree money may move",
    people: [person({ payoutReadiness: "ready" })],
    viewerUserId: "someone-else",
    liveSettlementEnabled: true,
    economicState: economicState({ nextAction: "fund" }),
    expectedLegacyActionId: "discover.fund_verified_work",
    expectedCanonicalActionId: "discover.fund_verified_work",
    expectAgreement: true,
  },
  {
    name: "another viewer, recipient ready, but the economic model finds NO real demand (no eligible mechanism) - a real, previously invisible mismatch: legacy still offers a fund button (economic-state-blind), canonical correctly withholds it",
    people: [person({ payoutReadiness: "ready" })],
    viewerUserId: "someone-else",
    liveSettlementEnabled: true,
    economicState: economicState({ nextAction: "none", state: "no_demand", demand: false }),
    expectedLegacyActionId: "discover.fund_verified_work",
    expectedCanonicalActionId: "discover.open_evidence",
    expectAgreement: false,
  },
  {
    name: "another viewer, recipient ready, a transfer is genuinely in flight right now (settlement_confirming, Release Slice 10) - the single most important finding: legacy would let a second payment be submitted on top of a real in-flight one, canonical correctly withholds the fund action",
    people: [person({ payoutReadiness: "ready" })],
    viewerUserId: "someone-else",
    liveSettlementEnabled: true,
    economicState: economicState({ nextAction: "none", state: "settlement_confirming", settlement: "confirming" }),
    expectedLegacyActionId: "discover.fund_verified_work",
    expectedCanonicalActionId: "discover.open_evidence",
    expectAgreement: false,
  },
  {
    name: "another viewer, recipient ready, a duplicate submission was detected (reconciliation_required, Release Slice 10) - same class of gap: legacy would still offer to fund again over an unresolved inconsistency",
    people: [person({ payoutReadiness: "ready" })],
    viewerUserId: "someone-else",
    liveSettlementEnabled: true,
    economicState: economicState({
      nextAction: "none",
      state: "reconciliation_required",
      settlement: "reconciliation_required",
      reconciliation: { kind: "duplicate_submission", detail: "2 separate transfers are simultaneously in flight for the same obligation." },
    }),
    expectedLegacyActionId: "discover.fund_verified_work",
    expectedCanonicalActionId: "discover.open_evidence",
    expectAgreement: false,
  },
  {
    name: "another viewer, recipient ready, but Arc settlement is not live - legacy keeps the same action id disabled (enabled:false), canonical withholds the action id entirely; both agree no money can move right now, expressed differently",
    people: [person({ payoutReadiness: "ready" })],
    viewerUserId: "someone-else",
    liveSettlementEnabled: false,
    economicState: economicState({ nextAction: "fund" }),
    expectedLegacyActionId: "discover.fund_verified_work",
    expectedCanonicalActionId: "discover.open_evidence",
    expectAgreement: false,
  },
  {
    name: "another viewer, recipient payout not ready - both systems correctly withhold the fund action (legacy: evidence only, disabled reason; canonical: evidence only, driven by economic model's own fund-requires-payout-ready rule)",
    people: [person({ payoutReadiness: "setup_required" })],
    viewerUserId: "someone-else",
    liveSettlementEnabled: true,
    economicState: economicState({ nextAction: "fund" }),
    expectedLegacyActionId: "discover.open_evidence",
    expectedCanonicalActionId: "discover.open_evidence",
    expectAgreement: true,
  },
];

describe("canonical action shadow resolver - parity matrix against the live attachVerifiedWorkActions()", () => {
  for (const row of rows) {
    it(row.name, () => {
      const [attached] = attachVerifiedWorkActions(
        [work()],
        row.people,
        row.viewerUserId,
        row.liveSettlementEnabled,
      );
      const legacyActionId = attached.primaryAction?.id;
      expect(legacyActionId).toBe(row.expectedLegacyActionId);

      const recipient = row.people[0];
      const canonicalActionId = resolveCanonicalAction({
        economicState: row.economicState,
        hasRecipientProfile: row.people.length > 0,
        viewerIsRecipient: Boolean(recipient && recipient.id === row.viewerUserId),
        recipientPayoutReady: recipient?.payoutReadiness === "ready",
        liveSettlementEnabled: row.liveSettlementEnabled,
      });
      expect(canonicalActionId).toBe(row.expectedCanonicalActionId);

      if (row.expectAgreement) {
        expect(canonicalActionId).toBe(legacyActionId);
      } else {
        expect(canonicalActionId).not.toBe(legacyActionId);
      }
    });
  }

  it("never permits MORE money movement than the legacy system: whenever they disagree, the canonical action is at least as restrictive", () => {
    // Money-movement risk is only real when legacy allows fund/authorize and
    // canonical would allow something the legacy system would not. Every
    // mismatch row above has canonical choosing open_evidence (the most
    // restrictive real outcome) over legacy's fund_verified_work - the
    // safety rule (Phase 5 section 19) holds for every disagreement found so
    // far. moreRestrictiveAction() is exercised directly here as the
    // documented, testable safety primitive future mismatches must also
    // satisfy - not merely re-deriving what the fixed rows above already
    // assert.
    const disagreements = rows.filter((row) => !row.expectAgreement);
    expect(disagreements.length).toBeGreaterThan(0);
    for (const row of disagreements) {
      const safe = moreRestrictiveAction(row.expectedLegacyActionId as CanonicalActionId, row.expectedCanonicalActionId);
      expect(safe).toBe(row.expectedCanonicalActionId);
    }
  });
});
