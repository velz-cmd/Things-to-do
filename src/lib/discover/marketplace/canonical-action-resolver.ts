import type { CanonicalEconomicState } from "@/lib/discover/marketplace/economic-state";

/**
 * Phase 5 Release Slice 11: a canonical primary-action resolver, run in
 * SHADOW MODE ONLY (per explicit user instruction) - it is compared against
 * the existing live `attachVerifiedWorkActions()` (query.ts) across a real
 * parity matrix, but its output is not yet wired into any UI or endpoint.
 * `attachVerifiedWorkActions()` remains the one system that actually decides
 * what a viewer sees and can click until Release Slice 12's safe cutover,
 * after a proven parity record.
 *
 * The legacy system runs BEFORE `economicState` exists on an item in the
 * real pipeline (query.ts calls `attachVerifiedWorkActions()` at line 3168,
 * `attachEconomicMatch()` at line 3210) - it is economic-state-blind by
 * construction today. This resolver is the opposite: it is driven entirely
 * by the canonical `economicState.nextAction` (Release Slices 1-10), plus
 * the same viewer-authority facts (self-attribution, recipient payout
 * readiness, live-settlement availability) the legacy system already
 * separately computes from `DiscoverPerson`. Viewer authority never mutates
 * the underlying economic truth - it only gates which action a specific
 * viewer may take on it (Phase 5 section 18).
 */
export type CanonicalActionId =
  | "discover.fund_verified_work"
  | "profile.set_payout_destination"
  | "discover.open_evidence"
  | "discover.authorize_settlement"
  | "discover.view_receipt"
  | "none";

export function resolveCanonicalAction(input: {
  /** The canonical economic projection for this outcome (Release Slice 1-10). Undefined when none was computed (non-work record, or run before economic matching). */
  economicState: CanonicalEconomicState | undefined;
  /** Whether a RESOLVE profile is attributed to this work at all - an unclaimed contributor can never be funded regardless of economic state. */
  hasRecipientProfile: boolean;
  /** The viewer IS the attributed recipient - self-funding is never offered, matching the legacy system exactly. */
  viewerIsRecipient: boolean;
  /** The attributed recipient's own verified payout destination is ready. */
  recipientPayoutReady: boolean;
  /** Arc settlement is actually live right now (real Circle credentials + feature flag + no live blockers). */
  liveSettlementEnabled: boolean;
}): CanonicalActionId {
  if (!input.hasRecipientProfile) return "discover.open_evidence";

  if (input.viewerIsRecipient) {
    return input.recipientPayoutReady
      ? "discover.open_evidence"
      : "profile.set_payout_destination";
  }

  const nextAction = input.economicState?.nextAction ?? "none";
  switch (nextAction) {
    case "fund":
      return input.recipientPayoutReady && input.liveSettlementEnabled
        ? "discover.fund_verified_work"
        : "discover.open_evidence";
    case "authorize":
      return "discover.authorize_settlement";
    case "view_receipt":
      return "discover.view_receipt";
    case "set_payout":
      // The canonical model's set_payout only ever concerns the recipient's
      // own destination - a non-recipient viewer has no action to take on
      // someone else's missing payout wallet.
      return "discover.open_evidence";
    case "review_funding":
    case "none":
    default:
      return "discover.open_evidence";
  }
}

/**
 * Restrictiveness order for the safety rule (Phase 5 section 19, explicit
 * user instruction): "on disagreement, choose the more restrictive action
 * until explicitly resolved." Money-moving/authorizing actions are least
 * restrictive (most permissive); inert/inspection actions are most
 * restrictive. Used only for parity-mismatch resolution in tests and any
 * future shadow-mode reporting - never to silently pick an action to render.
 */
const RESTRICTIVENESS_RANK: Record<CanonicalActionId, number> = {
  "discover.fund_verified_work": 0,
  "discover.authorize_settlement": 1,
  "profile.set_payout_destination": 2,
  "discover.view_receipt": 3,
  "discover.open_evidence": 4,
  none: 5,
};

/** The more restrictive (safer) of two candidate actions. Ties keep `a`. */
export function moreRestrictiveAction(
  a: CanonicalActionId,
  b: CanonicalActionId,
): CanonicalActionId {
  return RESTRICTIVENESS_RANK[b] > RESTRICTIVENESS_RANK[a] ? b : a;
}
