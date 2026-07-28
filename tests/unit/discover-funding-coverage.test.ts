import { describe, expect, it } from "vitest";
import {
  buildCoverageMatrix,
  buildDeterministicSummary,
  buildFundingCoverageCommandCentre,
  deriveAmountState,
  deriveContributorReadiness,
  deriveCoverageState,
  deriveFundingCycleStage,
  deriveNextAction,
  derivePoolReadiness,
  deriveSettlementState,
  summarizeSettlementStates,
  type FundingCoverageCommandInput,
} from "../../src/lib/discover/funding-coverage";

function input(overrides: Partial<FundingCoverageCommandInput> = {}): FundingCoverageCommandInput {
  return {
    selected: {
      fullName: "velz-cmd/Things-to-do",
      communitySlug: "resolve",
      snapshotPersisted: true,
      observedAt: "2026-07-28T12:00:00.000Z",
      stale: false,
    },
    coverage: [{
      category: "review",
      label: "Peer review",
      activityCount: 7,
      status: "uncovered",
      programIds: [],
      programNames: [],
      mechanism: "Accepted peer review has no active matching policy.",
    }],
    activity: [{
      id: "review:1",
      category: "review",
      title: "Review on #1",
      actor: "ada",
      occurredAt: "2026-07-28T11:00:00.000Z",
      sourceUrl: "https://github.com/velz-cmd/Things-to-do/pull/1",
      sourceKind: "review",
    }],
    programs: [],
    pools: [],
    outcomes: [],
    proof: {
      persistedEvents: 1,
      verificationState: "persisted",
      observedAt: "2026-07-28T12:00:00.000Z",
    },
    funding: {
      shortfallUsd: 0,
      blockedRecipients: 0,
      eligibleRecipients: 0,
      obligationCount: 0,
    },
    blockers: [],
    changes: { kind: "baseline" },
    settlement: {
      authorised: 0,
      submitted: 0,
      partiallyConfirmed: 0,
      confirmed: 0,
      reconciliationRequired: 0,
    },
    degradedSources: [],
    ...overrides,
  };
}

describe("Discover funding coverage selectors", () => {
  it("derives coverage only from accepted work and a matching policy", () => {
    expect(deriveCoverageState({ accepted: false, matchingPolicy: true })).toBe("no_activity");
    expect(deriveCoverageState({ accepted: true, matchingPolicy: false })).toBe("uncovered");
    expect(deriveCoverageState({ accepted: true, matchingPolicy: true })).toBe("covered");
  });

  it("does not claim contributor readiness when canonical identity state is unavailable", () => {
    expect(deriveContributorReadiness({
      attributionResolved: null,
      identityVerified: null,
      payoutReady: null,
    })).toBe("not_evaluated");
    expect(deriveContributorReadiness({
      attributionResolved: true,
      identityVerified: true,
      payoutReady: false,
    })).toBe("payout_blocked");
  });

  it("keeps submitted, partial, and confirmed amount states separate", () => {
    expect(deriveAmountState({ obligationUsd: 25, settlementState: "submitted" })).toBe("submitted");
    expect(deriveAmountState({ obligationUsd: 25, settlementState: "partially_confirmed" })).toBe("partially_confirmed");
    expect(deriveAmountState({ obligationUsd: 25, settlementState: "confirmed" })).toBe("confirmed");
  });

  it("derives Pool readiness from confirmed available capital without inventing funding", () => {
    expect(derivePoolReadiness({
      poolExists: true,
      availableUsd: 20,
      requiredUsd: 35,
      checkpointSatisfied: true,
    })).toBe("shortfall");
    expect(derivePoolReadiness({
      poolExists: false,
      availableUsd: null,
      requiredUsd: null,
      checkpointSatisfied: null,
    })).toBe("not_attached");
  });

  it("maps settlement lifecycle without treating submission as confirmation", () => {
    expect(deriveSettlementState({ status: "submitted" })).toBe("submitted");
    expect(deriveSettlementState({ status: "partial_confirmation" })).toBe("partially_confirmed");
    expect(deriveSettlementState({ status: "submitted", confirmedAt: "2026-07-28T12:00:00.000Z" })).toBe("confirmed");
  });

  it("does not treat a reconciled settlement as still requiring reconciliation", () => {
    expect(summarizeSettlementStates([
      { status: "failed" },
      { status: "reconciled" },
      { status: "submitted" },
    ])).toEqual({
      authorised: 0,
      submitted: 1,
      partiallyConfirmed: 0,
      confirmed: 0,
      reconciliationRequired: 1,
    });
  });

  it("selects missing policy before lower-priority funding or settlement actions", () => {
    const action = deriveNextAction(input({
      funding: { shortfallUsd: 100, blockedRecipients: 0, eligibleRecipients: 0, obligationCount: 2 },
      settlement: {
        authorised: 0,
        submitted: 1,
        partiallyConfirmed: 0,
        confirmed: 0,
        reconciliationRequired: 0,
      },
    }));
    expect(action).toMatchObject({
      id: "discover.start_mission",
      label: "Design funding rule",
      recordCount: 7,
    });
  });

  it("prioritizes source setup and stale evaluations before policy work", () => {
    expect(deriveNextAction(input({ selected: null }))).toMatchObject({
      id: "profile.connect_source",
      label: "Connect GitHub",
    });
    expect(deriveNextAction(input({
      selected: {
        fullName: "velz-cmd/Things-to-do",
        communitySlug: "resolve",
        snapshotPersisted: true,
        observedAt: "2026-07-28T12:00:00.000Z",
        stale: true,
      },
    }))).toMatchObject({
      id: "discover.capture_repository_snapshot",
      label: "Refresh evaluation",
    });
  });

  it("keeps optional financial failures behind the primary evaluation", () => {
    expect(deriveNextAction(input({ degradedSources: ["receipts", "pool:program-1"] }))).toMatchObject({
      id: "discover.start_mission",
      label: "Design funding rule",
    });
  });

  it("puts GitHub access and evidence review ahead of policy evaluation", () => {
    expect(deriveNextAction(input({
      blockers: [{ code: "github_permission_revoked", count: 1, recoveryHref: "/connect/github" }],
    }))).toMatchObject({
      id: "profile.connect_source",
      label: "Reconnect GitHub",
    });
    expect(deriveNextAction(input({
      blockers: [{ code: "evidence_review_required", count: 2, recoveryHref: "/discover" }],
    }))).toMatchObject({
      id: "discover.open_evidence",
      label: "Inspect evidence",
      recordCount: 2,
    });
  });

  it("routes attribution, identity, funding, confirmation, and receipt states to their owners", () => {
    const covered = [{
      category: "review" as const,
      label: "Peer review",
      activityCount: 7,
      status: "covered" as const,
      programIds: ["program-1"],
      programNames: ["Review program"],
      mechanism: "Covered by the active policy.",
    }];
    expect(deriveNextAction(input({
      coverage: covered,
      blockers: [{ code: "attribution_conflict", count: 2, recoveryHref: "/profile" }],
    }))).toMatchObject({ label: "Review attribution" });
    expect(deriveNextAction(input({
      coverage: covered,
      funding: { shortfallUsd: 0, blockedRecipients: 2, eligibleRecipients: 0, obligationCount: 2 },
    }))).toMatchObject({ label: "Resolve contributor identities" });
    expect(deriveNextAction(input({
      coverage: covered,
      funding: { shortfallUsd: 50, blockedRecipients: 0, eligibleRecipients: 2, obligationCount: 2 },
    }))).toMatchObject({ label: "Fund Pool" });
    expect(deriveNextAction(input({
      coverage: covered,
      settlement: {
        authorised: 0,
        submitted: 1,
        partiallyConfirmed: 0,
        confirmed: 0,
        reconciliationRequired: 0,
      },
    }))).toMatchObject({ label: "Track settlement" });
    expect(deriveNextAction(input({
      coverage: covered,
      settlement: {
        authorised: 0,
        submitted: 0,
        partiallyConfirmed: 1,
        confirmed: 0,
        reconciliationRequired: 0,
      },
    }))).toMatchObject({ label: "Review reconciliation" });
    expect(deriveNextAction(input({
      coverage: covered,
      outcomes: [{ publicReference: "receipt-1", payeeCount: 2, issuedAt: "2026-07-28T12:00:00.000Z" }],
      settlement: {
        authorised: 0,
        submitted: 0,
        partiallyConfirmed: 0,
        confirmed: 1,
        reconciliationRequired: 0,
      },
    }))).toMatchObject({ label: "View confirmed outcome" });
  });

  it("sends authorized settlement review to Capital before submitted tracking", () => {
    expect(deriveNextAction(input({
      coverage: [{
        category: "review",
        label: "Peer review",
        activityCount: 7,
        status: "covered",
        programIds: ["program-1"],
        programNames: ["Review program"],
        mechanism: "Covered by the active policy.",
      }],
      settlement: {
        authorised: 2,
        submitted: 1,
        partiallyConfirmed: 0,
        confirmed: 0,
        reconciliationRequired: 0,
      },
    }))).toMatchObject({
      id: "capital.authorize_settlement",
      label: "Review in Capital",
      recordCount: 2,
    });
  });

  it("builds a matrix with unavailable downstream values instead of false zeros", () => {
    const matrix = buildCoverageMatrix(input().coverage);
    const review = matrix.find((row) => row.category === "review");
    expect(review).toMatchObject({ accepted: 7, covered: 0, uncovered: 7 });
    expect(review?.obligations).toBeNull();
    expect(review?.confirmed).toBeNull();
  });

  it("builds a bounded evidence ledger and an honest baseline summary", () => {
    const command = buildFundingCoverageCommandCentre(input());
    expect(command.context.baseline).toBe(true);
    expect(command.ledger).toHaveLength(1);
    expect(command.ledger[0]).toMatchObject({
      policyState: "uncovered",
      amountState: "no_amount",
      filter: "needs_action",
    });
    expect(command.pulse.map((stage) => stage.label)).toEqual([
      "Accepted Work",
      "Covered",
      "Ready",
      "In Progress",
      "Confirmed",
    ]);
    expect(buildDeterministicSummary(input())).toContain("7 accepted records evaluated");
  });

  it("places a record at the last authoritative lifecycle stage", () => {
    expect(deriveFundingCycleStage({
      coverage: "covered",
      contributor: "ready",
      amount: "verified_obligation",
      pool: "ready",
      settlement: "submitted",
    })).toBe("submitted");
  });
});
