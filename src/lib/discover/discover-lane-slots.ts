import type { DiscoverAction, TrendingValueGap } from "@/lib/discover/types";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import type { UserConnectionState } from "@/lib/profile/connection-state-types";
import { communityReadyForDiscover } from "@/lib/discover/community-profile-link";
import { platformConnected } from "@/lib/profile/connection-state-types";
import { getCommunityValueProfile } from "@/lib/discover/community-value-profiles";
import type { DiscoverCardLane } from "@/lib/discover/types";
import {
  getOpportunityState,
  type ActionResolveInput,
  type DiscoverActionSlot,
} from "@/lib/discover/discover-opportunity-state";

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
  return (
    findAction(pool, "create_program") ??
    synthAction(gap, "rule", "Create payout rule", "create_program")
  );
}

function proofAction(pool: DiscoverAction[], gap: TrendingValueGap): DiscoverAction | undefined {
  const fromPool = findActionMatching(pool, /proof/i) ?? findAction(pool, "open");
  if (fromPool && (/proof/i.test(fromPool.label) || gap.proofHref || gap.entityPath)) {
    return fromPool;
  }
  if (gap.proofHref || gap.entityPath) {
    return synthAction(gap, "proof", "View proof", "open", {
      href: gap.proofHref,
      entityPath: gap.entityPath ?? (gap.communitySlug ? `/communities/${gap.communitySlug}` : undefined),
    });
  }
  return undefined;
}

function scanAction(pool: DiscoverAction[], gap: TrendingValueGap): DiscoverAction | undefined {
  return (
    findAction(pool, "analyze") ??
    (gap.communitySlug
      ? synthAction(gap, "scan", "Scan activity", "analyze", { communitySlug: gap.communitySlug })
      : undefined)
  );
}

function mapIdentityAction(pool: DiscoverAction[], gap: TrendingValueGap): DiscoverAction | undefined {
  return (
    findActionMatching(pool, /map|identity/i) ??
    synthAction(gap, "map-identity", "Map identity", "open", {
      href: "/profile",
      entityPath: "/profile",
    })
  );
}

function previewAction(pool: DiscoverAction[], gap: TrendingValueGap): DiscoverAction | undefined {
  return findActionMatching(pool, /split|preview/i);
}

function graphAction(gap: TrendingValueGap): DiscoverAction {
  return synthAction(gap, "graph", "Open value graph", "open", {
    href: "/discover#opportunities",
  });
}

function claimAction(pool: DiscoverAction[], gap: TrendingValueGap): DiscoverAction {
  return findAction(pool, "claim") ?? synthAction(gap, "claim", "Claim earnings", "claim");
}

function receiptAction(pool: DiscoverAction[], gap: TrendingValueGap): DiscoverAction | undefined {
  const fromPool = findAction(pool, "share") ?? findActionMatching(pool, /receipt/i);
  if (fromPool?.href) return fromPool;
  if (!gap.proofHref) return undefined;
  return synthAction(gap, "receipt", "View receipt", "share", { href: gap.proofHref });
}

function setupAction(pool: DiscoverAction[], gap: TrendingValueGap): DiscoverAction {
  const install = findAction(pool, "install");
  if (install) {
    return {
      ...install,
      label: install.label.replace(/^Set up/i, "Create community program for"),
    };
  }
  return findAction(pool, "connect_sensor") ?? profileConnectAction(gap);
}

function canClaimGap(
  gap: TrendingValueGap,
  connections: UserConnectionState | null | undefined,
): boolean {
  if (!connections?.signedIn) return false;
  if (!gap.amountVerified && !gap.proofAuthorizationId) return false;
  if (gap.domain === "oss" && !connections.githubUsername) return false;
  if (gap.domain === "music" && !platformConnected(connections, "navidrome") && !platformConnected(connections, "listenbrainz")) {
    return false;
  }
  return gap.actions.some((a) => a.kind === "claim") || Boolean(gap.proofAuthorizationId);
}

type SlotContext = {
  input: ActionResolveInput;
  pool: DiscoverAction[];
  gap: TrendingValueGap;
  connected: boolean;
  state: ReturnType<typeof getOpportunityState>;
  effectiveRole: DiscoverRole;
  push: (slot: DiscoverActionSlot) => void;
  fund: DiscoverAction;
  rule: DiscoverAction;
  proof: DiscoverAction | undefined;
  scan: DiscoverAction | undefined;
  claim: DiscoverAction;
  receipt: DiscoverAction | undefined;
  connect: DiscoverAction;
  preview: DiscoverAction | undefined;
  mapIdentity: DiscoverAction | undefined;
};

function signedOutSlots(ctx: SlotContext) {
  ctx.push({
    action: ctx.fund,
    variant: "primary",
    disabled: true,
    disabledReason: "Sign in to continue",
  });
}

/** Live Signals — prove activity; fund only when obligation exists. */
function resolveRadarsSlots(input: ActionResolveInput): DiscoverActionSlot[] {
  const slots: DiscoverActionSlot[] = [];
  const push = (slot: DiscoverActionSlot) => {
    if (slots.length >= 3) return;
    if (slots.some((s) => s.action.id === slot.action.id && s.action.kind === slot.action.kind)) return;
    slots.push(slot);
  };

  const { gap, connections, role, signedIn, spendableUsd } = input;
  const pool = gap.actions;
  const connected = gap.communitySlug != null && communityReadyForDiscover(gap.communitySlug, connections);
  const state = getOpportunityState(gap, connected);
  const effectiveRole = role === "all" ? "operator" : role;

  const ctx: SlotContext = {
    input,
    pool,
    gap,
    connected,
    state,
    effectiveRole,
    push,
    fund: fundAction(pool, gap),
    rule: ruleAction(pool, gap),
    proof: proofAction(pool, gap),
    scan: scanAction(pool, gap),
    claim: claimAction(pool, gap),
    receipt: receiptAction(pool, gap),
    connect: setupAction(pool, gap),
    preview: previewAction(pool, gap),
    mapIdentity: mapIdentityAction(pool, gap),
  };

  if (!signedIn) {
    signedOutSlots(ctx);
    return slots;
  }

  if (state === "claimable" && canClaimGap(gap, connections)) {
    push({ action: ctx.claim, variant: "primary" });
    if (ctx.proof) push({ action: ctx.proof, variant: "secondary" });
    return slots;
  }

  if (state === "settled") {
    if (ctx.receipt) push({ action: ctx.receipt, variant: "primary" });
    else if (ctx.proof) push({ action: ctx.proof, variant: "primary" });
    return slots;
  }

  if (state === "detected") {
    push({ action: ctx.connect, variant: "primary" });
    if (ctx.scan) {
      push({
        action: ctx.scan,
        variant: "secondary",
        disabled: true,
        disabledReason: "Connect source first",
      });
    }
    return slots;
  }

  if (state === "verified") {
    if (ctx.scan) push({ action: ctx.scan, variant: "primary" });
    else push({ action: ctx.rule, variant: "primary" });
    if (effectiveRole === "operator" || effectiveRole === "founder") {
      if (ctx.rule && slots[0]?.action.kind !== "create_program") {
        push({ action: ctx.rule, variant: "secondary" });
      }
    }
    if (ctx.proof && slots.length < 3) push({ action: ctx.proof, variant: "secondary" });
    if (ctx.mapIdentity && slots.length < 3) push({ action: ctx.mapIdentity, variant: "secondary" });
    return slots;
  }

  if (state === "programmed") {
    if (effectiveRole === "funder" || effectiveRole === "dao") {
      const lowBalance = spendableUsd != null && spendableUsd < 5;
      push({
        action: ctx.fund,
        variant: "primary",
        disabled: lowBalance,
        disabledReason: lowBalance ? "Add Arc USDC first" : undefined,
      });
    } else {
      push({ action: ctx.rule, variant: "primary" });
    }
    if (ctx.proof) push({ action: ctx.proof, variant: "secondary" });
    return slots;
  }

  // funded
  if (ctx.proof) push({ action: ctx.proof, variant: "primary" });
  if (ctx.scan && slots.length < 3) push({ action: ctx.scan, variant: "secondary" });
  return slots;
}

/** Unpaid Value — fund, rule, scan, preview, proof. */
function resolveGapsSlots(input: ActionResolveInput): DiscoverActionSlot[] {
  const slots: DiscoverActionSlot[] = [];
  const push = (slot: DiscoverActionSlot) => {
    if (slots.length >= 3) return;
    if (slots.some((s) => s.action.id === slot.action.id && s.action.kind === slot.action.kind)) return;
    slots.push(slot);
  };

  const { gap, connections, role, signedIn, spendableUsd } = input;
  const pool = gap.actions;
  const connected = gap.communitySlug != null && communityReadyForDiscover(gap.communitySlug, connections);
  const state = getOpportunityState(gap, connected);
  const effectiveRole = role === "all" ? "funder" : role;

  const ctx: SlotContext = {
    input,
    pool,
    gap,
    connected,
    state,
    effectiveRole,
    push,
    fund: fundAction(pool, gap),
    rule: ruleAction(pool, gap),
    proof: proofAction(pool, gap),
    scan: scanAction(pool, gap),
    claim: claimAction(pool, gap),
    receipt: receiptAction(pool, gap),
    connect: setupAction(pool, gap),
    preview: previewAction(pool, gap),
    mapIdentity: mapIdentityAction(pool, gap),
  };

  if (!signedIn) {
    signedOutSlots(ctx);
    return slots;
  }

  if (state === "claimable") {
    if (canClaimGap(gap, connections)) {
      push({ action: ctx.claim, variant: "primary" });
      if (ctx.proof) push({ action: ctx.proof, variant: "secondary" });
    } else if (ctx.proof) {
      push({
        action: ctx.claim,
        variant: "primary",
        disabled: true,
        disabledReason: "Only creator can claim",
      });
      push({ action: ctx.proof, variant: "secondary" });
    }
    return slots;
  }

  if (state === "settled") {
    if (ctx.receipt) push({ action: ctx.receipt, variant: "primary" });
    else if (ctx.proof) push({ action: ctx.proof, variant: "primary" });
    return slots;
  }

  if (state === "detected") {
    if (effectiveRole === "funder" || effectiveRole === "dao") {
      push({
        action: ctx.fund,
        variant: "primary",
        disabled: true,
        disabledReason: "Connect source in Profile first",
      });
      push({ action: ctx.connect, variant: "secondary" });
    } else {
      push({ action: ctx.connect, variant: "primary" });
    }
    return slots;
  }

  if (state === "verified") {
    if (effectiveRole === "funder" || effectiveRole === "dao") {
      push({
        action: ctx.fund,
        variant: "primary",
        disabled: true,
        disabledReason: "Program rule required",
      });
      if (ctx.proof) push({ action: ctx.proof, variant: "secondary" });
    } else {
      push({ action: ctx.rule, variant: "primary" });
      if (ctx.scan) push({ action: ctx.scan, variant: "secondary" });
      else if (ctx.proof) push({ action: ctx.proof, variant: "secondary" });
    }
    return slots;
  }

  if (state === "programmed") {
    const lowBalance = spendableUsd != null && spendableUsd < 5;
    push({
      action: ctx.fund,
      variant: "primary",
      disabled: lowBalance,
      disabledReason: lowBalance ? "Add Arc USDC first" : undefined,
    });
    if (ctx.preview) push({ action: ctx.preview, variant: "secondary" });
    else if (ctx.proof) push({ action: ctx.proof, variant: "secondary" });
    return slots;
  }

  // funded
  push({ action: ctx.fund, variant: "primary" });
  if (ctx.proof) push({ action: ctx.proof, variant: "secondary" });
  else push({ action: graphAction(gap), variant: "secondary" });
  return slots;
}

/** Value Graph board rows — same money flow as gaps with graph context. */
function resolveGraphSlots(input: ActionResolveInput): DiscoverActionSlot[] {
  const slots = resolveGapsSlots(input);
  if (slots.length < 3 && !slots.some((s) => s.action.id === "graph")) {
    const graph = graphAction(input.gap);
    if (slots.length < 3) {
      slots.push({ action: graph, variant: slots.length === 0 ? "primary" : "secondary" });
    }
  }
  return slots.slice(0, 3);
}

/** Tab-specific action slots — Discover / Live Signals / Value Graph. */
export function resolveLaneActionSlots(input: ActionResolveInput): DiscoverActionSlot[] {
  switch (input.lane) {
    case "radars":
      return resolveRadarsSlots(input);
    case "graph":
      return resolveGraphSlots(input);
    case "gaps":
    default:
      return resolveGapsSlots(input);
  }
}
