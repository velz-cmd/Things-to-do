import type { DiscoverAction, TrendingValueGap } from "@/lib/discover/types";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import type { UserConnectionState } from "@/lib/profile/connection-state-types";
import type { DiscoverCardLane } from "@/lib/discover/types";
import { resolveLaneActionSlots } from "@/lib/discover/discover-lane-slots";

export type OpportunityState =
  | "detected"
  | "verified"
  | "programmed"
  | "funded"
  | "settled"
  | "claimable";

export type DiscoverActionSlot = {
  action: DiscoverAction;
  variant: "primary" | "secondary";
  disabled?: boolean;
  disabledReason?: string;
};

export type ActionResolveInput = {
  gap: TrendingValueGap;
  connections: UserConnectionState | null | undefined;
  role: DiscoverRole;
  lane: DiscoverCardLane;
  signedIn: boolean;
  spendableUsd: number | null;
};

function hasActiveRule(gap: TrendingValueGap): boolean {
  const rules = gap.valueMetrics?.payoutRules ?? "";
  if (Boolean(gap.programId)) return true;
  const lower = rules.toLowerCase();
  if (!lower.includes("active") || lower.includes("missing")) return false;
  // "0 active" means no rules; "10 active" must not match the zero check
  if (/(^|\s)0(\s+active|\s+rules?|$)/.test(lower)) return false;
  return true;
}

export function gapHasActiveRule(gap: TrendingValueGap): boolean {
  return hasActiveRule(gap);
}

function isFunded(gap: TrendingValueGap): boolean {
  const settlement = gap.valueMetrics?.settlement ?? "";
  if (settlement.toLowerCase().includes("active") || settlement.toLowerCase().includes("funded")) {
    return true;
  }
  return gap.amountVerified && (gap.moneyCanMoveUsd > 0 || gap.amountNeededUsd > 0);
}

function isSettled(gap: TrendingValueGap): boolean {
  const settlement = gap.valueMetrics?.settlement ?? "";
  return settlement.toLowerCase().includes("settled") || settlement.toLowerCase().includes("on arc");
}

export function gapIsFunded(gap: TrendingValueGap): boolean {
  return isFunded(gap);
}

export function gapIsSettled(gap: TrendingValueGap): boolean {
  return isSettled(gap);
}

function isClaimable(gap: TrendingValueGap): boolean {
  return Boolean(
    gap.amountVerified &&
      gap.moneyCanMoveUsd > 0 &&
      (gap.actions.some((a) => a.kind === "claim") || gap.proofAuthorizationId),
  );
}

export function getOpportunityState(
  gap: TrendingValueGap,
  connected: boolean,
): OpportunityState {
  if (isClaimable(gap)) return "claimable";
  if (isSettled(gap)) return "settled";
  if (!connected) return "detected";
  if (!hasActiveRule(gap)) return "verified";
  if (!isFunded(gap)) return "programmed";
  return "funded";
}

/** Resolve 1 primary + up to 2 secondary real actions for the current state, role, and tab lane. */
export function resolveDiscoverActionSlots(input: ActionResolveInput): DiscoverActionSlot[] {
  return resolveLaneActionSlots(input);
}
