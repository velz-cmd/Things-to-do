import type { DiscoverAction, TrendingValueGap } from "@/lib/discover/types";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import type { UserConnectionState } from "@/lib/profile/connection-state-types";
import { communityReadyForDiscover } from "@/lib/discover/community-profile-link";
import { getCommunityValueProfile } from "@/lib/discover/community-value-profiles";
import type { DiscoverCardLane } from "@/lib/discover/types";

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
  return lower.includes("active") && !lower.includes("missing") && !lower.includes("0");
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

function profileConnectAction(gap: TrendingValueGap): DiscoverAction {
  const profile = gap.communitySlug ? getCommunityValueProfile(gap.communitySlug) : null;
  const source = profile?.upstream.split(" · ")[0] ?? "source";
  return synthAction(gap, "connect-profile", `Connect ${source}`, "connect_sensor", {
    href: "/profile",
  });
}

function fundAction(pool: DiscoverAction[], gap: TrendingValueGap): DiscoverAction {
  return (
    findAction(pool, "fund") ??
    findAction(pool, "sponsor") ??
    synthAction(gap, "fund", "Fund pool", "fund")
  );
}

function ruleAction(pool: DiscoverAction[], gap: TrendingValueGap): DiscoverAction {
  return findAction(pool, "create_program") ?? synthAction(gap, "rule", "Create payout rule", "create_program");
}

function proofAction(pool: DiscoverAction[], gap: TrendingValueGap): DiscoverAction | undefined {
  return (
    findActionMatching(pool, /proof/i) ??
    findAction(pool, "open") ??
    (gap.proofHref || gap.entityPath
      ? synthAction(gap, "proof", "View proof", "open", {
          href: gap.proofHref,
          entityPath: gap.entityPath ?? (gap.communitySlug ? `/communities/${gap.communitySlug}` : undefined),
        })
      : undefined)
  );
}

function scanAction(pool: DiscoverAction[], gap: TrendingValueGap): DiscoverAction | undefined {
  return (
    findAction(pool, "analyze") ??
    (gap.communitySlug
      ? synthAction(gap, "scan", "Scan activity", "analyze", {
          entityPath: `/communities/${gap.communitySlug}`,
        })
      : undefined)
  );
}

function claimAction(pool: DiscoverAction[], gap: TrendingValueGap): DiscoverAction {
  return findAction(pool, "claim") ?? synthAction(gap, "claim", "Claim earnings", "claim");
}

function receiptAction(pool: DiscoverAction[], gap: TrendingValueGap): DiscoverAction | undefined {
  return (
    findAction(pool, "share") ??
    findActionMatching(pool, /receipt/i) ??
    synthAction(gap, "receipt", "View receipt", "share", { href: gap.proofHref })
  );
}

/** Resolve 1 primary + up to 2 secondary real actions for the current state and role. */
export function resolveDiscoverActionSlots(input: ActionResolveInput): DiscoverActionSlot[] {
  const { gap, connections, role, lane, signedIn, spendableUsd } = input;
  const pool = gap.actions;
  const connected =
    gap.communitySlug != null && communityReadyForDiscover(gap.communitySlug, connections);
  const state = getOpportunityState(gap, connected);
  const slots: DiscoverActionSlot[] = [];

  const push = (slot: DiscoverActionSlot) => {
    if (slots.length >= 3) return;
    if (slots.some((s) => s.action.id === slot.action.id && s.action.kind === slot.action.kind)) {
      return;
    }
    slots.push(slot);
  };

  const fund = fundAction(pool, gap);
  const rule = ruleAction(pool, gap);
  const proof = proofAction(pool, gap);
  const scan = scanAction(pool, gap);
  const claim = claimAction(pool, gap);
  const receipt = receiptAction(pool, gap);
  const connect = findAction(pool, "connect_sensor") ?? profileConnectAction(gap);

  const effectiveRole = role === "all" ? "funder" : role;

  if (!signedIn) {
    push({
      action: fund,
      variant: "primary",
      disabled: true,
      disabledReason: "Sign in to continue",
    });
    return slots;
  }

  if (state === "claimable" && (effectiveRole === "community" || effectiveRole === "founder")) {
    push({ action: claim, variant: "primary" });
    if (proof) push({ action: proof, variant: "secondary" });
    return slots;
  }

  if (state === "settled") {
    if (receipt) push({ action: receipt, variant: "primary" });
    else if (proof) push({ action: proof, variant: "primary" });
    return slots;
  }

  if (state === "detected") {
    if (effectiveRole === "funder" || effectiveRole === "dao") {
      push({
        action: fund,
        variant: "primary",
        disabled: true,
        disabledReason: "Connect source in Profile first",
      });
      push({ action: connect, variant: "secondary" });
    } else {
      push({ action: connect, variant: "primary" });
      if (lane === "radars" && scan) push({ action: scan, variant: "secondary", disabled: true, disabledReason: "Connect source first" });
    }
    return slots;
  }

  if (state === "verified") {
    if (effectiveRole === "funder") {
      push({
        action: fund,
        variant: "primary",
        disabled: true,
        disabledReason: "Program rule required",
      });
      if (proof) push({ action: proof, variant: "secondary" });
    } else if (effectiveRole === "operator" || lane === "radars") {
      push({ action: rule, variant: "primary" });
      if (scan) push({ action: scan, variant: "secondary" });
      if (proof && slots.length < 3) push({ action: proof, variant: "secondary" });
    } else {
      push({ action: rule, variant: "primary" });
      if (proof) push({ action: proof, variant: "secondary" });
    }
    return slots;
  }

  if (state === "programmed") {
    const lowBalance = spendableUsd != null && spendableUsd < 5;
    push({
      action: fund,
      variant: "primary",
      disabled: lowBalance,
      disabledReason: lowBalance ? "Add Arc USDC first" : undefined,
    });
    const preview = findActionMatching(pool, /split|preview/i);
    if (preview) push({ action: preview, variant: "secondary" });
    else if (proof) push({ action: proof, variant: "secondary" });
    return slots;
  }

  // funded — ready to settle or add more
  if (effectiveRole === "funder" || effectiveRole === "dao") {
    push({ action: fund, variant: "primary" });
  } else {
    push({ action: fund, variant: "primary" });
  }
  if (proof) push({ action: proof, variant: "secondary" });
  if (lane === "radars" && scan && slots.length < 3) push({ action: scan, variant: "secondary" });

  return slots;
}
