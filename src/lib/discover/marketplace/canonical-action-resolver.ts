import type { CanonicalEconomicState } from "@/lib/discover/marketplace/economic-state";
import type { MarketplaceOpportunity } from "@/lib/discover/marketplace/contracts";

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

/** A real, specific reason for each way the canonical resolver restricts an action the legacy system would have allowed. Never a generic "not available" string. */
function restrictionReason(state: CanonicalEconomicState | undefined): string {
  switch (state?.state) {
    case "settlement_confirming":
      return "A transfer for this work reward is already in progress.";
    case "reconciliation_required":
      return "This work reward has a payment inconsistency awaiting review before more funds can move.";
    case "fully_covered":
      return "This work reward has already been paid.";
    default:
      return "No active funding mechanism currently applies to this work.";
  }
}

/**
 * Release Slice 12: the safe cutover. This does NOT replace
 * `attachVerifiedWorkActions()` - it runs AFTER it (and after
 * `attachEconomicMatch()`, once `economicState` exists) as a
 * restriction-only gate: it can only ever turn an already-enabled
 * `discover.fund_verified_work` action into a disabled one when the
 * canonical resolver - now armed with real economic state
 * `attachVerifiedWorkActions()` never sees - disagrees. It can never grant
 * an action the legacy system withheld (Phase 5 section 19's explicit
 * safety rule). This is deliberately narrower than a full migration: every
 * other legacy action path (self-attribution, payout setup, unclaimed
 * contributor) is untouched, because the Release Slice 11 parity matrix
 * proved those paths already agree.
 *
 * The three facts assumed true when the gate is even reached
 * (recipient profile exists, viewer is not the recipient, recipient payout
 * is ready, live settlement is enabled) are exactly the legacy
 * preconditions for `enabled: true` on `discover.fund_verified_work` in
 * the first place - see `query.ts`'s `attachVerifiedWorkActions()`. If the
 * legacy system already disabled or withheld the action, this gate does
 * nothing, by construction (`RESTRICTIVENESS_RANK` is never consulted to
 * loosen anything here - only to fail loudly in tests if that were ever
 * attempted).
 */
export function applyCanonicalActionSafetyGate(
  items: MarketplaceOpportunity[],
): MarketplaceOpportunity[] {
  return items.map((item) => {
    if (
      item.primaryAction?.id !== "discover.fund_verified_work" ||
      item.primaryAction.enabled !== true
    ) {
      return item;
    }
    const canonical = resolveCanonicalAction({
      economicState: item.economicState,
      hasRecipientProfile: true,
      viewerIsRecipient: false,
      recipientPayoutReady: true,
      liveSettlementEnabled: true,
    });
    if (canonical === "discover.fund_verified_work") return item;
    return {
      ...item,
      primaryAction: {
        ...item.primaryAction,
        enabled: false,
        disabledReason: restrictionReason(item.economicState),
      },
    } satisfies MarketplaceOpportunity;
  });
}
