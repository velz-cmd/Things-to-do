import { describe, expect, it } from "vitest";
import { matchImpactToCapital } from "@/lib/discover/impact/economic-matching";
import type {
  CoverageRecord,
  FundingIntentCandidate,
} from "@/lib/discover/impact/economic-matching";
import type { FundingCoverageLedgerRecord } from "@/lib/discover/funding-coverage";
import {
  computeCanonicalCoverage,
  resolveCanonicalEconomicStateFromLedgerRecord,
  resolveCanonicalEconomicStateFromMatch,
} from "@/lib/discover/marketplace/economic-state";

function pool(overrides: Partial<FundingIntentCandidate> = {}): FundingIntentCandidate {
  return {
    id: "pool-1",
    mechanism: "pool_allocation",
    label: "Security Response Fund",
    eligibleClasses: ["security"],
    availableUsd: 500,
    executable: true,
    ...overrides,
  };
}

describe("computeCanonicalCoverage - amount-based coverage", () => {
  it("returns null remaining and not-fully-covered when required amount is unknown", () => {
    const coverage = computeCanonicalCoverage([], null);
    expect(coverage).toMatchObject({
      requiredUsd: null,
      confirmedUsd: 0,
      pendingUsd: 0,
      remainingUsd: null,
      fullyCovered: false,
    });
  });

  it("sums only confirmed records into confirmedUsd - pending is never counted as coverage", () => {
    const records: CoverageRecord[] = [
      { id: "1", mechanism: "pool_allocation", amountUsd: 40, purpose: "p", status: "confirmed" },
      { id: "2", mechanism: "pool_allocation", amountUsd: 20, purpose: "p", status: "pending" },
    ];
    const coverage = computeCanonicalCoverage(records, 100);
    expect(coverage.confirmedUsd).toBe(40);
    expect(coverage.pendingUsd).toBe(20);
    expect(coverage.remainingUsd).toBe(60);
    expect(coverage.fullyCovered).toBe(false);
  });

  it("a record with no status field defaults to confirmed - preserves every pre-existing caller", () => {
    const records: CoverageRecord[] = [
      { id: "1", mechanism: "direct_support", amountUsd: 30, purpose: "p" },
    ];
    const coverage = computeCanonicalCoverage(records, 30);
    expect(coverage.confirmedUsd).toBe(30);
    expect(coverage.fullyCovered).toBe(true);
  });

  it("excludes failed records entirely from both confirmed and pending", () => {
    const records: CoverageRecord[] = [
      { id: "1", mechanism: "pool_allocation", amountUsd: 100, purpose: "p", status: "failed" },
    ];
    const coverage = computeCanonicalCoverage(records, 100);
    expect(coverage.confirmedUsd).toBe(0);
    expect(coverage.pendingUsd).toBe(0);
    expect(coverage.remainingUsd).toBe(100);
  });

  it("overfunding never produces a negative remaining amount", () => {
    const records: CoverageRecord[] = [
      { id: "1", mechanism: "pool_allocation", amountUsd: 120, purpose: "p", status: "confirmed" },
    ];
    const coverage = computeCanonicalCoverage(records, 100);
    expect(coverage.remainingUsd).toBe(0);
    expect(coverage.fullyCovered).toBe(true);
    expect(coverage.confirmedUsd).toBe(120);
  });
});

describe("resolveCanonicalEconomicStateFromMatch - canonical state precedence", () => {
  it("no funding intent at all -> no_demand, no action", () => {
    const match = matchImpactToCapital({
      outcomeClass: "security",
      purpose: "fix",
      hasSourcedImpact: true,
      intents: [],
      coverage: [],
    });
    const canonical = resolveCanonicalEconomicStateFromMatch({
      match,
      payout: "not_required",
    });
    expect(canonical.state).toBe("no_demand");
    expect(canonical.demand).toBe(false);
    expect(canonical.nextAction).toBe("none");
  });

  it("intents exist but none match this class -> blocked, not no_demand (real demand was considered)", () => {
    const match = matchImpactToCapital({
      outcomeClass: "documentation",
      purpose: "docs",
      hasSourcedImpact: true,
      intents: [pool({ eligibleClasses: ["security"] })],
      coverage: [],
    });
    const canonical = resolveCanonicalEconomicStateFromMatch({
      match,
      payout: "not_required",
    });
    expect(canonical.state).toBe("blocked");
    expect(canonical.demand).toBe(true);
  });

  it("a real eligible mechanism with no coverage yet and no review needed -> funding_available, action fund", () => {
    const match = matchImpactToCapital({
      outcomeClass: "security",
      purpose: "fix",
      hasSourcedImpact: true,
      intents: [pool()],
      coverage: [],
    });
    const canonical = resolveCanonicalEconomicStateFromMatch({
      match,
      requiredUsd: 100,
      payout: "destination_ready",
    });
    expect(canonical.state).toBe("funding_available");
    expect(canonical.nextAction).toBe("fund");
    expect(canonical.mechanism).toBe("pool_allocation");
  });

  it("a real match but the recipient has no payout destination -> payout_setup_required, never funding_available", () => {
    const match = matchImpactToCapital({
      outcomeClass: "security",
      purpose: "fix",
      hasSourcedImpact: true,
      intents: [pool()],
      coverage: [],
    });
    const canonical = resolveCanonicalEconomicStateFromMatch({
      match,
      requiredUsd: 100,
      payout: "destination_missing",
    });
    expect(canonical.state).toBe("payout_setup_required");
    expect(canonical.nextAction).toBe("set_payout");
  });

  it("partial confirmed coverage -> partially_covered, action review_funding", () => {
    const match = matchImpactToCapital({
      outcomeClass: "security",
      purpose: "fix",
      hasSourcedImpact: true,
      intents: [pool()],
      coverage: [
        { id: "1", mechanism: "pool_allocation", amountUsd: 40, purpose: "different purpose", status: "confirmed" },
      ],
    });
    const canonical = resolveCanonicalEconomicStateFromMatch({
      match,
      requiredUsd: 100,
      payout: "destination_ready",
    });
    expect(canonical.state).toBe("partially_covered");
    expect(canonical.coverage.confirmedUsd).toBe(40);
    expect(canonical.coverage.remainingUsd).toBe(60);
    expect(canonical.nextAction).toBe("review_funding");
  });

  it("full confirmed coverage -> fully_covered, action view_receipt", () => {
    const match = matchImpactToCapital({
      outcomeClass: "security",
      purpose: "fix",
      hasSourcedImpact: true,
      intents: [pool()],
      coverage: [
        { id: "1", mechanism: "pool_allocation", amountUsd: 100, purpose: "different purpose", status: "confirmed" },
      ],
    });
    const canonical = resolveCanonicalEconomicStateFromMatch({
      match,
      requiredUsd: 100,
      payout: "destination_ready",
    });
    expect(canonical.state).toBe("fully_covered");
    expect(canonical.nextAction).toBe("view_receipt");
  });

  it("same obligation already settled (duplicate_obligation) -> fully_covered, never pay twice", () => {
    const match = matchImpactToCapital({
      outcomeClass: "security",
      purpose: "fix vuln",
      obligationId: "obl-1",
      hasSourcedImpact: true,
      intents: [pool()],
      coverage: [
        {
          id: "1",
          mechanism: "pool_allocation",
          amountUsd: 100,
          purpose: "fix vuln",
          obligationId: "obl-1",
          status: "confirmed",
        },
      ],
    });
    const canonical = resolveCanonicalEconomicStateFromMatch({
      match,
      payout: "destination_ready",
    });
    expect(canonical.state).toBe("fully_covered");
    expect(canonical.eligibility.eligible).toBe(false);
    expect(canonical.mechanism).toBeNull();
  });

  it("possible overlap (same purpose, different obligation) requires human review -> authorization_required", () => {
    const match = matchImpactToCapital({
      outcomeClass: "security",
      purpose: "fix vuln",
      hasSourcedImpact: true,
      intents: [pool()],
      coverage: [
        { id: "1", mechanism: "direct_support", amountUsd: 20, purpose: "fix vuln", status: "confirmed" },
      ],
    });
    // No coverage counted toward THIS obligation (different obligationId / no id match),
    // but the matcher itself already flags this as requiresReview via possible_overlap.
    const canonical = resolveCanonicalEconomicStateFromMatch({
      match,
      payout: "destination_ready",
    });
    expect(match.requiresReview).toBe(true);
    expect(canonical.state).toBe("authorization_required");
    expect(canonical.authorization).toEqual({ required: true, granted: false });
    expect(canonical.nextAction).toBe("authorize");
  });

  it("a real settlement already submitted takes precedence over the matcher's own recommendation", () => {
    const match = matchImpactToCapital({
      outcomeClass: "security",
      purpose: "fix",
      hasSourcedImpact: true,
      intents: [pool()],
      coverage: [],
    });
    const canonical = resolveCanonicalEconomicStateFromMatch({
      match,
      requiredUsd: 100,
      payout: "destination_ready",
      settlementState: "submitted",
    });
    expect(canonical.state).toBe("settlement_submitted");
    expect(canonical.nextAction).toBe("none");
  });

  it("a confirmed settlement resolves to settlement_confirmed with a receipt action", () => {
    const match = matchImpactToCapital({
      outcomeClass: "security",
      purpose: "fix",
      hasSourcedImpact: true,
      intents: [pool()],
      coverage: [
        { id: "1", mechanism: "pool_allocation", amountUsd: 100, purpose: "fix", status: "confirmed" },
      ],
    });
    const canonical = resolveCanonicalEconomicStateFromMatch({
      match,
      requiredUsd: 100,
      payout: "destination_ready",
      settlementState: "confirmed",
    });
    expect(canonical.state).toBe("settlement_confirmed");
    expect(canonical.nextAction).toBe("view_receipt");
  });

  it("a failed settlement requires reconciliation, never silently resolved", () => {
    const match = matchImpactToCapital({
      outcomeClass: "security",
      purpose: "fix",
      hasSourcedImpact: true,
      intents: [pool()],
      coverage: [],
    });
    const canonical = resolveCanonicalEconomicStateFromMatch({
      match,
      requiredUsd: 100,
      payout: "destination_ready",
      settlementState: "failed",
    });
    expect(canonical.state).toBe("reconciliation_required");
    expect(canonical.nextAction).toBe("none");
  });
});

function ledgerRecord(
  overrides: Partial<FundingCoverageLedgerRecord> = {},
): FundingCoverageLedgerRecord {
  return {
    id: "record-1",
    repository: "acme/widget",
    workType: "Merged pull request",
    category: "code",
    title: "Fix crash on startup",
    contributor: "@dev",
    acceptedAt: "2026-08-01T00:00:00.000Z",
    sourceUrl: "https://github.com/acme/widget/pull/1",
    evidenceState: "verified",
    evidenceId: "evidence-1",
    policyState: "covered",
    policyReason: "Maintenance Pool covers code contributions.",
    policyVersion: 1,
    identityState: "ready",
    amountState: "claimable",
    amountUsd: 80,
    poolState: "available",
    poolName: "Maintenance Pool",
    blocker: "",
    nextAction: {
      id: "capital.open_funding",
      label: "Fund",
      reason: "",
      href: "/discover",
      recordCount: 1,
    },
    filter: "ready",
    freshness: "current",
    timeline: [],
    ...overrides,
  };
}

describe("resolveCanonicalEconomicStateFromLedgerRecord - funding-coverage.ts as a domain adapter", () => {
  it("the section 5 worked example: a real obligation, partially confirmed, produces partially_covered", () => {
    const canonical = resolveCanonicalEconomicStateFromLedgerRecord(
      ledgerRecord({ amountState: "partially_confirmed", amountUsd: 80 }),
    );
    expect(canonical.state).toBe("partially_covered");
    expect(canonical.coverage.requiredUsd).toBe(80);
    expect(canonical.nextAction).toBe("review_funding");
  });

  it("no amount at all -> no_demand when no Pool is attached", () => {
    const canonical = resolveCanonicalEconomicStateFromLedgerRecord(
      ledgerRecord({
        amountState: "no_amount",
        amountUsd: null,
        policyState: "uncovered",
        poolState: "not_attached",
        poolName: null,
      }),
    );
    expect(canonical.state).toBe("no_demand");
    expect(canonical.demand).toBe(false);
  });

  it("uncovered by policy but a Pool exists -> blocked, not no_demand", () => {
    const canonical = resolveCanonicalEconomicStateFromLedgerRecord(
      ledgerRecord({ policyState: "uncovered", amountState: "no_amount", amountUsd: null }),
    );
    expect(canonical.state).toBe("blocked");
  });

  it("claimable with a ready payout destination -> funding_available", () => {
    const canonical = resolveCanonicalEconomicStateFromLedgerRecord(
      ledgerRecord({ amountState: "claimable", identityState: "ready" }),
    );
    expect(canonical.state).toBe("funding_available");
    expect(canonical.payout).toBe("destination_ready");
    expect(canonical.nextAction).toBe("fund");
  });

  it("a real obligation but the contributor's payout is blocked -> payout_setup_required, not funding_available", () => {
    const canonical = resolveCanonicalEconomicStateFromLedgerRecord(
      ledgerRecord({ amountState: "claimable", identityState: "payout_blocked" }),
    );
    expect(canonical.state).toBe("payout_setup_required");
    expect(canonical.nextAction).toBe("set_payout");
  });

  it("confirmed amount -> fully_covered with the full amount as confirmedUsd", () => {
    const canonical = resolveCanonicalEconomicStateFromLedgerRecord(
      ledgerRecord({ amountState: "confirmed", amountUsd: 80 }),
    );
    expect(canonical.state).toBe("fully_covered");
    expect(canonical.coverage.confirmedUsd).toBe(80);
    expect(canonical.coverage.remainingUsd).toBe(0);
  });

  it("a failed settlement requires reconciliation, never silently resolved", () => {
    const canonical = resolveCanonicalEconomicStateFromLedgerRecord(
      ledgerRecord({ amountState: "failed" }),
    );
    expect(canonical.state).toBe("reconciliation_required");
    expect(canonical.settlement).toBe("failed");
  });

  it("submitted amount is pending, never confirmed coverage", () => {
    const canonical = resolveCanonicalEconomicStateFromLedgerRecord(
      ledgerRecord({ amountState: "submitted", amountUsd: 80 }),
    );
    expect(canonical.coverage.confirmedUsd).toBe(0);
    expect(canonical.coverage.pendingUsd).toBe(80);
    expect(canonical.state).toBe("partially_covered");
  });
});
