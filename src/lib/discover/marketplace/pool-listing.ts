import type { DiscoverPool } from "@/lib/discover/marketplace/contracts";

export type PoolListingEligibility =
  | "MARKET_LISTED"
  | "OPERATOR_SETUP_REQUIRED"
  | "MANUAL_GOVERNANCE_REVIEW"
  | "INACTIVE";

/**
 * The one canonical authority for whether a Pool belongs in public Discover
 * inventory. Replaces ad-hoc checks like `lifecycleState === "accepting_funding"`
 * (misses Pools that are funded/distributing but still real market state) and
 * action-shape heuristics like `primaryAction.presentation.target.panel ===
 * "program_setup"` (couples listing to whatever action happened to be built,
 * rather than to the Pool's actual configuration state).
 *
 * Precedence matches the order a Pool actually becomes fundable: policy and
 * treasury are prerequisites for publication, so an unmet prerequisite is
 * reported even if publicationState also happens to read as review-required.
 */
export function computePoolListingEligibility(
  pool: DiscoverPool,
): PoolListingEligibility {
  if (pool.lifecycleState === "paused") return "INACTIVE";
  if (pool.lifecycleState === "setup_incomplete") return "OPERATOR_SETUP_REQUIRED";
  if (pool.policyState === "setup_required") return "OPERATOR_SETUP_REQUIRED";
  if (pool.treasuryReadiness === "setup_required") return "OPERATOR_SETUP_REQUIRED";
  if (pool.publicationState === "operator_review_required") {
    return "MANUAL_GOVERNANCE_REVIEW";
  }
  return "MARKET_LISTED";
}

export function isMarketListedPool(pool: DiscoverPool): boolean {
  return computePoolListingEligibility(pool) === "MARKET_LISTED";
}
