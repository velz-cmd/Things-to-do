import type { CanonicalEconomicState } from "./economic-state";

/**
 * Split out of economic-state.ts deliberately: this file has zero
 * dependencies beyond a type-only import, so it is safe to import as a
 * VALUE from a client component (discover-marketplace.tsx). economic-state.ts
 * itself imports node:crypto at module scope (for computePolicyFingerprint/
 * computeObligationId) - a value import of anything from that file pulls
 * node:crypto into whichever bundle imports it, which breaks the browser
 * bundle ("UnhandledSchemeError: Reading from node:crypto is not handled
 * by plugins"). Keep every crypto-free, UI-safe export here; keep every
 * server-only/crypto-using export in economic-state.ts.
 */

/**
 * Release Slice 3: customer-language mapping (Phase 5 section 21).
 * Internal state names stay internal; this is the one place every UI
 * consumer gets its plain-language sentence, so wording changes happen in
 * one place instead of being copy-pasted and drifting per component.
 * Includes real amounts when known - "60 USDC remaining" is more useful
 * than the generic "Partially funded" whenever a number exists.
 */
export function canonicalStateLabel(state: CanonicalEconomicState): string {
  const { coverage } = state;
  switch (state.state) {
    case "no_demand":
      return "No current funding demand";
    case "demand_found":
      return "Funding intent exists, not yet available";
    case "possible_match":
      return "Possible funding match - identity needs review";
    case "eligible":
      return "Eligible for funding";
    case "funding_available":
      return "Funding available";
    case "authorization_required":
      return "Needs funder review before payment";
    case "payout_setup_required":
      return "Payout setup needed";
    case "partially_covered":
      return coverage.remainingUsd != null
        ? `${coverage.remainingUsd.toFixed(2)} USDC remaining`
        : "Partially funded";
    case "fully_covered":
      return coverage.confirmedUsd > 0
        ? `${coverage.confirmedUsd.toFixed(2)} USDC confirmed`
        : "Fully covered";
    case "settlement_submitted":
      return "Payment submitted";
    case "settlement_confirming":
      return "Payment confirming";
    case "settlement_confirmed":
      return "Payment confirmed";
    case "reconciliation_required":
      return "Payment needs reconciliation";
    case "blocked":
      return "No current funding match";
  }
}
