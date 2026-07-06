import type { DiscoverAction, TrendingValueGap } from "@/lib/discover/types";
import type { UserConnectionState } from "@/lib/profile/connection-state-types";
import { communityReadyForDiscover } from "@/lib/discover/community-profile-link";
import { getCommunityValueProfile } from "@/lib/discover/community-value-profiles";
import {
  connectSourceLabel,
  fulfillPoolLabel,
  viewProofLabel,
} from "@/lib/discover/discover-receipt-actions";
import {
  getOpportunityState,
  type ActionResolveInput,
  type DiscoverActionSlot,
} from "@/lib/discover/discover-opportunity-state";
import { gapProofHref } from "@/lib/discover/gap-rules";

const MAX_SLOTS = 3;

function actionKey(action: DiscoverAction): string {
  return `${action.kind}:${action.id}`;
}

function findAction(pool: DiscoverAction[], kind: DiscoverAction["kind"]): DiscoverAction | undefined {
  return pool.find((a) => a.kind === kind);
}

function findActionMatching(pool: DiscoverAction[], pattern: RegExp): DiscoverAction | undefined {
  return pool.find((a) => pattern.test(a.label));
}

function synthAction(
  gap: TrendingValueGap,
  id: string,
  label: string,
  kind: DiscoverAction["kind"],
  extra: Partial<DiscoverAction> = {},
): DiscoverAction {
  return {
    id,
    label,
    kind,
    communitySlug: gap.communitySlug,
    templateId: gap.templateId,
    programId: gap.programId,
    missionId: gap.missionId,
    ...extra,
  };
}

function firstSourceLabel(value: string | undefined): string {
  return value?.split(/\s*(?:\+|\u00b7|\u00c2\u00b7)\s*/)[0]?.trim() || "source";
}

function profileConnectAction(gap: TrendingValueGap): DiscoverAction {
  const profile = gap.communitySlug ? getCommunityValueProfile(gap.communitySlug) : null;
  const source = firstSourceLabel(profile?.upstream);
  return synthAction(gap, "connect-profile", connectSourceLabel(source), "connect_sensor", {
    href: "/profile",
  });
}

function fundAction(pool: DiscoverAction[], gap: TrendingValueGap): DiscoverAction {
  const fromPool = findAction(pool, "fund");
  const label = fulfillPoolLabel(gap.templateId);
  if (fromPool) return { ...fromPool, label };
  return synthAction(gap, "fund", label, "fund");
}

function proofAction(pool: DiscoverAction[], gap: TrendingValueGap): DiscoverAction | undefined {
  const fromPool = findActionMatching(pool, /proof|receipt/i) ?? findAction(pool, "open");
  const label = viewProofLabel();
  if (fromPool?.href || fromPool?.entityPath) {
    const href = fromPool.href ?? fromPool.entityPath;
    if (href?.includes("/receipt/") && !gapProofHref(gap)?.includes("/receipt/")) {
      /* ignore stale receipt links on preview rows */
    } else {
      return { ...fromPool, label, kind: "open" };
    }
  }
  const href = gapProofHref(gap);
  if (href) {
    return synthAction(gap, "proof", label, "open", {
      href,
      entityPath: gap.entityPath,
    });
  }
  return undefined;
}

function connectAction(pool: DiscoverAction[], gap: TrendingValueGap): DiscoverAction {
  const fromPool = findAction(pool, "connect_sensor");
  if (fromPool) return fromPool;
  return profileConnectAction(gap);
}

function makePush(slots: DiscoverActionSlot[]) {
  return (slot: DiscoverActionSlot) => {
    if (slots.length >= MAX_SLOTS) return;
    const key = actionKey(slot.action);
    if (slots.some((s) => actionKey(s.action) === key)) return;
    slots.push(slot);
  };
}

function lowBalanceFlags(spendableUsd: number | null | undefined) {
  const lowBalance = spendableUsd != null && spendableUsd < 5;
  return {
    lowBalance,
    lowBalanceReason: lowBalance
      ? "Minimum funding is $5 USDC. Add funds in Capital or connect your wallet."
      : undefined,
  };
}

/**
 * Phase A — three actions only on Discover primary surfaces:
 * 1. Fulfill pool (fund)
 * 2. Connect source (when connector missing)
 * 3. View proof (receipt / authorization)
 */
function resolveValueReceiptSlots(input: ActionResolveInput): DiscoverActionSlot[] {
  const slots: DiscoverActionSlot[] = [];
  const push = makePush(slots);

  const { gap, connections, signedIn, spendableUsd } = input;
  const pool = gap.actions;
  const connected =
    gap.communitySlug != null && communityReadyForDiscover(gap.communitySlug, connections);
  const state = getOpportunityState(gap, connected);
  const fund = fundAction(pool, gap);
  const connect = connectAction(pool, gap);
  const proof = proofAction(pool, gap);
  const { lowBalance, lowBalanceReason } = lowBalanceFlags(spendableUsd);

  if (!signedIn) {
    push({ action: fund, variant: "primary", disabled: true, disabledReason: "Sign in to continue" });
    if (!connected) {
      push({ action: connect, variant: "secondary", disabled: true, disabledReason: "Sign in to connect sources" });
    }
    return slots;
  }

  if (state === "settled") {
    if (proof) push({ action: proof, variant: "primary" });
    return slots;
  }

  if (!connected || state === "detected") {
    push({
      action: fund,
      variant: "primary",
      disabled: true,
      disabledReason: "Connect the proof source in Profile first.",
    });
    push({ action: connect, variant: "secondary" });
    if (proof) push({ action: proof, variant: "secondary" });
    return slots;
  }

  push({
    action: fund,
    variant: "primary",
    disabled: lowBalance,
    disabledReason: lowBalanceReason,
  });

  if (proof) {
    push({ action: proof, variant: "secondary" });
  }

  return slots;
}

/** Phase A — no advanced / cosmetic action chips on Discover cards. */
export function resolveLaneAdvancedActions(
  _input: ActionResolveInput,
  _slots: DiscoverActionSlot[],
): DiscoverAction[] {
  return [];
}

/** Tab-specific action slots — all lanes use the same 3-action value receipt pattern. */
export function resolveLaneActionSlots(input: ActionResolveInput): DiscoverActionSlot[] {
  return resolveValueReceiptSlots(input);
}
