import type { EconomicActionItem } from "@/lib/discover/marketplace/contracts";

/**
 * Phase 5 Release Slice 16: pure row-building logic for the Details
 * drawer's Funding section, split out of discover-action-workbench.tsx
 * (a "use client" component) so it is directly testable without a React
 * rendering harness - matching this directory's existing convention
 * (workbench-state.ts).
 *
 * Reads the SAME canonical economicState already live everywhere else
 * (Slices 1-15) - never a second query, never recomputed here. Only
 * meaningful rows are included; a caller renders nothing extra when a row
 * is absent (Phase 5 sections 14/15: simplify the decision surface, never
 * hide useful information that IS present).
 */

export function mechanismLabel(mechanism: string): string {
  switch (mechanism) {
    case "pool_allocation":
      return "Pool allocation";
    case "sponsor_program":
      return "Sponsor program";
    case "funded_request":
      return "Funded request";
    case "recurring_support":
      return "Recurring support";
    case "direct_support":
      return "Direct support";
    default:
      return mechanism.replaceAll("_", " ");
  }
}

export function payoutStateLabel(payout: string): string {
  switch (payout) {
    case "not_required":
      return "No payout required";
    case "unknown_recipient":
      return "Recipient not yet identified";
    case "recipient_identified":
      return "Recipient identified, destination not yet confirmed";
    case "destination_missing":
      return "Payout destination needed";
    case "destination_ready":
      return "Payout ready";
    case "blocked":
      return "Payout blocked";
    default:
      return payout.replaceAll("_", " ");
  }
}

/**
 * Release Slice 13/22: never call "provisional" or "unavailable" by the
 * same word as a genuinely persisted, verified policy - ABSENT POLICY !=
 * POLICY LOOKUP FAILED, in the customer-facing copy, not just internally.
 */
export function policyProvenanceLabel(
  provenance: "persisted" | "provisional" | "unavailable",
): string {
  switch (provenance) {
    case "persisted":
      return "Policy verified from a published Program version";
    case "unavailable":
      return "Policy verification unavailable right now";
    case "provisional":
      return "Policy identity derived from current published rules";
  }
}

export type FundingRow = { label: string; value: string };

export function buildFundingRows(
  state: EconomicActionItem["economicState"],
): FundingRow[] {
  if (!state) return [];
  const { coverage, obligation } = state;
  const rows: FundingRow[] = [];

  if (obligation?.mechanism) {
    rows.push({ label: "Mechanism", value: mechanismLabel(obligation.mechanism) });
  }
  if (coverage.requiredUsd != null) {
    rows.push({ label: "Requirement", value: `${coverage.requiredUsd.toFixed(2)} USDC` });
  }
  if (coverage.confirmedUsd > 0) {
    rows.push({ label: "Confirmed", value: `${coverage.confirmedUsd.toFixed(2)} USDC` });
  }
  if (coverage.pendingUsd > 0) {
    rows.push({ label: "Confirming", value: `${coverage.pendingUsd.toFixed(2)} USDC` });
  }
  if (coverage.remainingUsd != null && coverage.remainingUsd > 0) {
    rows.push({ label: "Remaining", value: `${coverage.remainingUsd.toFixed(2)} USDC` });
  }
  if (state.payout) {
    rows.push({ label: "Payout", value: payoutStateLabel(state.payout) });
  }
  if (obligation?.policyProvenance) {
    rows.push({ label: "Policy", value: policyProvenanceLabel(obligation.policyProvenance) });
  }
  if (state.reconciliation) {
    rows.push({ label: "Status", value: state.reconciliation.detail });
  }
  if (coverage.dataAvailability === "unavailable") {
    rows.push({ label: "Coverage", value: "Could not be verified right now" });
  }

  return rows;
}
