import { describe, expect, it } from "vitest";
import {
  assessOverlap,
  matchImpactToCapital,
  type CoverageRecord,
  type FundingIntentCandidate,
} from "../../src/lib/discover/impact/economic-matching";

const securityPool: FundingIntentCandidate = {
  id: "pool-1",
  mechanism: "pool_allocation",
  label: "Security Response Pool",
  eligibleClasses: ["security"],
  availableUsd: 500,
  executable: true,
};

const docsProgram: FundingIntentCandidate = {
  id: "program-1",
  mechanism: "sponsor_program",
  label: "Documentation Program",
  eligibleClasses: ["documentation"],
  availableUsd: 200,
  executable: true,
};

const directSupport: FundingIntentCandidate = {
  id: "direct-1",
  mechanism: "direct_support",
  label: "Direct voluntary support",
  eligibleClasses: [],
  availableUsd: 50,
  executable: true,
};

describe("Economic matching engine", () => {
  it("offers no mechanism when no funding intent covers the outcome", () => {
    const match = matchImpactToCapital({
      outcomeClass: "security",
      purpose: "retroactive impact",
      hasSourcedImpact: true,
      intents: [docsProgram],
      coverage: [],
    });
    expect(match.recommended).toBeNull();
    expect(match.eligible).toHaveLength(0);
    expect(match.excluded[0]?.reason).toContain("not security");
    expect(match.recommendationReason).toMatch(/not offering a payment/i);
  });

  it("never recommends Reward by default - it names the specific delegated capital", () => {
    const match = matchImpactToCapital({
      outcomeClass: "security",
      purpose: "retroactive impact",
      hasSourcedImpact: true,
      intents: [directSupport, securityPool],
      coverage: [],
    });
    // Pool is delegated capital with a mandate; it outranks asking an
    // individual to pay voluntarily for the same outcome.
    expect(match.recommended).toBe("pool_allocation");
    expect(match.requiresReview).toBe(false);
  });

  it("refuses to settle the same obligation twice", () => {
    const coverage: CoverageRecord[] = [
      {
        id: "receipt-1",
        mechanism: "pool_allocation",
        amountUsd: 250,
        purpose: "retroactive impact",
        obligationId: "obl-1",
        receiptReference: "rcpt_abc",
      },
    ];
    const match = matchImpactToCapital({
      outcomeClass: "security",
      purpose: "retroactive impact",
      obligationId: "obl-1",
      hasSourcedImpact: true,
      intents: [securityPool],
      coverage,
    });
    expect(match.overlap).toBe("duplicate_obligation");
    expect(match.recommended).toBeNull();
    expect(match.eligible).toHaveLength(0);
    expect(match.overlapReason).toContain("rcpt_abc");
  });

  it("allows a different economic purpose rather than blocking all repeat payment", () => {
    // A bounty for delivery and a retroactive grant for sustained adoption
    // are different purposes - both can be legitimate.
    const { verdict } = assessOverlap({
      purpose: "retroactive adoption impact",
      coverage: [
        {
          id: "r1",
          mechanism: "funded_request",
          amountUsd: 500,
          purpose: "implementation delivery",
        },
      ],
    });
    expect(verdict).toBe("no_conflict");
  });

  it("flags the same purpose for funder review instead of silently paying or blocking", () => {
    const match = matchImpactToCapital({
      outcomeClass: "security",
      purpose: "implementation delivery",
      hasSourcedImpact: true,
      intents: [securityPool],
      coverage: [
        {
          id: "r1",
          mechanism: "funded_request",
          amountUsd: 500,
          purpose: "implementation delivery",
        },
      ],
    });
    expect(match.overlap).toBe("possible_overlap");
    expect(match.requiresReview).toBe(true);
    // Still eligible - a human decides, it is not silently blocked.
    expect(match.recommended).toBe("pool_allocation");
  });

  it("gates delegated capital on sourced impact but never gates voluntary support", () => {
    const withoutEvidence = matchImpactToCapital({
      outcomeClass: "security",
      purpose: "retroactive impact",
      hasSourcedImpact: false,
      intents: [securityPool, directSupport],
      coverage: [],
    });
    // Pool needs measured outcomes; a person's own voluntary choice does not.
    expect(withoutEvidence.recommended).toBe("direct_support");
    expect(
      withoutEvidence.excluded.some((m) => m.intent.mechanism === "pool_allocation"),
    ).toBe(true);
  });

  it("excludes capital that cannot execute or that the viewer may not allocate", () => {
    const match = matchImpactToCapital({
      outcomeClass: "security",
      purpose: "retroactive impact",
      hasSourcedImpact: true,
      intents: [
        { ...securityPool, executable: false, blocker: "Treasury not configured." },
        {
          ...securityPool,
          id: "pool-2",
          label: "Operator Pool",
          requiresRole: "operator",
        },
      ],
      coverage: [],
      viewerRoles: [],
    });
    expect(match.recommended).toBeNull();
    expect(match.excluded.map((m) => m.reason)).toEqual(
      expect.arrayContaining([
        "Treasury not configured.",
        expect.stringContaining("Only the operator"),
      ]),
    );
  });

  it("excludes capital that cannot cover the required amount", () => {
    const match = matchImpactToCapital({
      outcomeClass: "security",
      purpose: "retroactive impact",
      requiredUsd: 900,
      hasSourcedImpact: true,
      intents: [securityPool],
      coverage: [],
    });
    expect(match.recommended).toBeNull();
    expect(match.excluded[0]?.reason).toContain("below the $900.00 required");
  });
});

/**
 * Phase 5 Release Slice 13: status-aware overlap semantics. FAILED != a
 * confirmed prior payment (never coverage, never "already paid"). PENDING
 * != CONFIRMED (a real transaction in flight still blocks a second
 * payment, but must never claim money already moved).
 */
describe("assessOverlap - status-aware, never conflates failed/pending/confirmed", () => {
  it("a failed settlement is never coverage and never blocks a legitimate new attempt", () => {
    const { verdict, reason } = assessOverlap({
      purpose: "implementation delivery",
      obligationId: "obl-1",
      coverage: [
        {
          id: "r1",
          mechanism: "pool_allocation",
          amountUsd: 500,
          purpose: "implementation delivery",
          obligationId: "obl-1",
          status: "failed",
        },
      ],
    });
    expect(verdict).toBe("no_conflict");
    expect(reason).toMatch(/no prior payment/i);
  });

  it("a pending record for the exact same obligation blocks further spend as settlement_in_progress, never duplicate_obligation - nothing has actually settled twice", () => {
    const { verdict, reason } = assessOverlap({
      purpose: "implementation delivery",
      obligationId: "obl-1",
      coverage: [
        {
          id: "r1",
          mechanism: "pool_allocation",
          amountUsd: 500,
          purpose: "implementation delivery",
          obligationId: "obl-1",
          status: "pending",
        },
      ],
    });
    expect(verdict).toBe("settlement_in_progress");
    expect(reason).toMatch(/already in progress/i);
    expect(reason).not.toMatch(/already settled/i);
    expect(reason).not.toMatch(/already paid/i);
  });

  it("a confirmed record for the exact same obligation is duplicate_obligation, with real 'already settled' language", () => {
    const { verdict, reason } = assessOverlap({
      purpose: "implementation delivery",
      obligationId: "obl-1",
      coverage: [
        {
          id: "r1",
          mechanism: "pool_allocation",
          amountUsd: 500,
          purpose: "implementation delivery",
          obligationId: "obl-1",
          status: "confirmed",
        },
      ],
    });
    expect(verdict).toBe("duplicate_obligation");
    expect(reason).toMatch(/already settled/i);
  });

  it("a pending record for the same purpose (no obligationId match) is settlement_in_progress, never possible_overlap phrased as 'already paid'", () => {
    const { verdict, reason } = assessOverlap({
      purpose: "implementation delivery",
      coverage: [
        {
          id: "r1",
          mechanism: "funded_request",
          amountUsd: 500,
          purpose: "implementation delivery",
          status: "pending",
        },
      ],
    });
    expect(verdict).toBe("settlement_in_progress");
    expect(reason).not.toMatch(/already paid/i);
  });

  it("matchImpactToCapital blocks further spend for settlement_in_progress the same way as duplicate_obligation", () => {
    const match = matchImpactToCapital({
      outcomeClass: "security",
      purpose: "implementation delivery",
      obligationId: "obl-1",
      hasSourcedImpact: true,
      intents: [securityPool],
      coverage: [
        {
          id: "r1",
          mechanism: "pool_allocation",
          amountUsd: 500,
          purpose: "implementation delivery",
          obligationId: "obl-1",
          status: "pending",
        },
      ],
    });
    expect(match.overlap).toBe("settlement_in_progress");
    expect(match.recommended).toBeNull();
    expect(match.eligible).toHaveLength(0);
  });

  it("a failed record never blocks matchImpactToCapital's recommendation - the funder may legitimately retry", () => {
    const match = matchImpactToCapital({
      outcomeClass: "security",
      purpose: "implementation delivery",
      obligationId: "obl-1",
      hasSourcedImpact: true,
      intents: [securityPool],
      coverage: [
        {
          id: "r1",
          mechanism: "pool_allocation",
          amountUsd: 500,
          purpose: "implementation delivery",
          obligationId: "obl-1",
          status: "failed",
        },
      ],
    });
    expect(match.overlap).toBe("no_conflict");
    expect(match.recommended).toBe("pool_allocation");
  });
});
