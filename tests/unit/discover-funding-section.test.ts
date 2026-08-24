import { describe, expect, it } from "vitest";
import {
  buildFundingRows,
  mechanismLabel,
  payoutStateLabel,
  policyProvenanceLabel,
} from "@/components/resolve/discover/marketplace/funding-section";
import type { CanonicalEconomicState } from "@/lib/discover/marketplace/economic-state";

/**
 * Phase 5 Release Slice 16: end-to-end test of the Details projection's
 * pure row-building logic. No second resolver - every row comes straight
 * from the same canonical economicState already live everywhere else.
 */

function state(overrides: Partial<CanonicalEconomicState> = {}): CanonicalEconomicState {
  return {
    state: "funding_available",
    demand: true,
    eligibility: { eligible: true, reason: "eligible" },
    obligation: null,
    coverage: {
      requiredUsd: null,
      confirmedUsd: 0,
      pendingUsd: 0,
      remainingUsd: null,
      currency: "USDC",
      records: [],
      fullyCovered: false,
      dataAvailability: "available",
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

describe("buildFundingRows - the Details drawer's Funding section, real rows only", () => {
  it("no economicState - no fabricated Funding section (empty row list)", () => {
    expect(buildFundingRows(undefined)).toEqual([]);
  });

  it("no demand at all - a truthful no-demand row set, never an empty dead object", () => {
    const rows = buildFundingRows(state({ state: "no_demand", demand: false, mechanism: null, obligation: null, payout: "not_required" }));
    expect(rows.some((r) => r.label === "Payout" && r.value === "No payout required")).toBe(true);
    // No mechanism row is fabricated when there genuinely is none.
    expect(rows.some((r) => r.label === "Mechanism")).toBe(false);
  });

  it("confirmed coverage produces a real Confirmed row with the exact amount", () => {
    const rows = buildFundingRows(
      state({
        obligation: { amountUsd: 100, purpose: "p", mechanism: "direct_support" },
        coverage: {
          requiredUsd: 100,
          confirmedUsd: 40,
          pendingUsd: 0,
          remainingUsd: 60,
          currency: "USDC",
          records: [],
          fullyCovered: false,
          dataAvailability: "available",
        },
      }),
    );
    expect(rows).toContainEqual({ label: "Confirmed", value: "40.00 USDC" });
    expect(rows).toContainEqual({ label: "Remaining", value: "60.00 USDC" });
  });

  it("pending coverage produces a Confirming row, never a Confirmed row for the same amount - PENDING != CONFIRMED", () => {
    const rows = buildFundingRows(
      state({
        coverage: {
          requiredUsd: 100,
          confirmedUsd: 0,
          pendingUsd: 20,
          remainingUsd: 100,
          currency: "USDC",
          records: [],
          fullyCovered: false,
          dataAvailability: "available",
        },
      }),
    );
    expect(rows).toContainEqual({ label: "Confirming", value: "20.00 USDC" });
    expect(rows.some((r) => r.label === "Confirmed")).toBe(false);
  });

  it("partial coverage produces the real Remaining row", () => {
    const rows = buildFundingRows(
      state({
        coverage: {
          requiredUsd: 100,
          confirmedUsd: 40,
          pendingUsd: 0,
          remainingUsd: 60,
          currency: "USDC",
          records: [],
          fullyCovered: false,
          dataAvailability: "available",
        },
      }),
    );
    expect(rows).toContainEqual({ label: "Remaining", value: "60.00 USDC" });
  });

  it("payout setup required is surfaced by its own row, translated to plain language", () => {
    const rows = buildFundingRows(state({ payout: "destination_missing" }));
    expect(rows).toContainEqual({ label: "Payout", value: "Payout destination needed" });
  });

  it("persisted policy provenance reads as genuinely verified, never the same word as provisional", () => {
    const rows = buildFundingRows(
      state({
        obligation: {
          amountUsd: 100,
          purpose: "p",
          mechanism: "pool_allocation",
          policyFingerprint: "hash-abc",
          policyProvenance: "persisted",
        },
      }),
    );
    expect(rows).toContainEqual({ label: "Policy", value: "Policy verified from a published Program version" });
  });

  it("provisional policy provenance is labeled honestly, never claiming verification", () => {
    const rows = buildFundingRows(
      state({
        obligation: {
          amountUsd: 100,
          purpose: "p",
          mechanism: "pool_allocation",
          policyFingerprint: "hash-provisional",
          policyProvenance: "provisional",
        },
      }),
    );
    expect(rows).toContainEqual({ label: "Policy", value: "Policy identity derived from current published rules" });
  });

  it("unavailable policy provenance is labeled unavailable, never silently downgraded to provisional", () => {
    const rows = buildFundingRows(
      state({
        obligation: {
          amountUsd: 100,
          purpose: "p",
          mechanism: "pool_allocation",
          policyProvenance: "unavailable",
        },
      }),
    );
    expect(rows).toContainEqual({ label: "Policy", value: "Policy verification unavailable right now" });
  });

  it("coverage data unavailable surfaces its own truthful row, never reading as zero coverage", () => {
    const rows = buildFundingRows(
      state({
        state: "verification_unavailable",
        coverage: {
          requiredUsd: 100,
          confirmedUsd: 0,
          pendingUsd: 0,
          remainingUsd: null,
          currency: "USDC",
          records: [],
          fullyCovered: false,
          dataAvailability: "unavailable",
        },
      }),
    );
    expect(rows).toContainEqual({ label: "Coverage", value: "Could not be verified right now" });
  });

  it("a real reconciliation issue surfaces its exact detail text, never a generic message", () => {
    const rows = buildFundingRows(
      state({
        state: "reconciliation_required",
        reconciliation: { kind: "duplicate_submission", detail: "2 separate transfers are simultaneously in flight for the same obligation." },
      }),
    );
    expect(rows).toContainEqual({
      label: "Status",
      value: "2 separate transfers are simultaneously in flight for the same obligation.",
    });
  });
});

describe("mechanismLabel / payoutStateLabel / policyProvenanceLabel - plain-language translation", () => {
  it("translates every real mechanism value to plain language", () => {
    expect(mechanismLabel("pool_allocation")).toBe("Pool allocation");
    expect(mechanismLabel("direct_support")).toBe("Direct support");
    expect(mechanismLabel("recurring_support")).toBe("Recurring support");
  });

  it("translates every real payout state to plain language", () => {
    expect(payoutStateLabel("destination_ready")).toBe("Payout ready");
    expect(payoutStateLabel("destination_missing")).toBe("Payout destination needed");
  });

  it("gives each policy provenance value distinct, honest wording", () => {
    const labels = new Set([
      policyProvenanceLabel("persisted"),
      policyProvenanceLabel("provisional"),
      policyProvenanceLabel("unavailable"),
    ]);
    expect(labels.size).toBe(3);
  });
});
