import type { DiscoverAction, TrendingValueGap } from "@/lib/discover/types";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import type { UserConnectionState } from "@/lib/profile/connection-state-types";
import { communityReadyForDiscover } from "@/lib/discover/community-profile-link";
import { platformConnected } from "@/lib/profile/connection-state-types";
import { getCommunityValueProfile } from "@/lib/discover/community-value-profiles";
import type { DiscoverCardLane } from "@/lib/discover/types";
import {
  buildAgentAnalyzeActionForGap,
  buildAutomateActionForGap,
} from "@/lib/discover/need-types";
import {
  getOpportunityState,
  type ActionResolveInput,
  type DiscoverActionSlot,
} from "@/lib/discover/discover-opportunity-state";

const MAX_SLOTS = 3;
const MAX_ADVANCED = 5;

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

function profileConnectAction(gap: TrendingValueGap): DiscoverAction {
  const profile = gap.communitySlug ? getCommunityValueProfile(gap.communitySlug) : null;
  const source = profile?.upstream.split(" · ")[0] ?? "source";
  return synthAction(gap, "connect-profile", `Connect ${source}`, "connect_sensor", {
    href: "/profile",
  });
}

function fundAction(pool: DiscoverAction[], gap: TrendingValueGap, label = "Fund pool"): DiscoverAction {
  const fromPool = findAction(pool, "fund") ?? findAction(pool, "sponsor");
  if (fromPool) return { ...fromPool, label: label === "Fund pool" ? fromPool.label : label };
  return synthAction(gap, "fund", label, "fund");
}

function rewardAction(pool: DiscoverAction[], gap: TrendingValueGap): DiscoverAction {
  return fundAction(pool, gap, "Reward contributors");
}

function ruleAction(pool: DiscoverAction[], gap: TrendingValueGap): DiscoverAction {
  const fromPool = findAction(pool, "create_program");
  if (fromPool) return { ...fromPool, label: "Create reward program" };
  return synthAction(gap, "rule", "Create reward program", "create_program");
}

function proofAction(pool: DiscoverAction[], gap: TrendingValueGap): DiscoverAction | undefined {
  const fromPool = findActionMatching(pool, /proof/i) ?? findAction(pool, "open");
  if (fromPool && (/proof/i.test(fromPool.label) || gap.proofHref || gap.entityPath)) {
    return { ...fromPool, label: "View live proof" };
  }
  if (gap.proofHref || gap.entityPath) {
    return synthAction(gap, "proof", "View live proof", "open", {
      href: gap.proofHref,
      entityPath: gap.entityPath ?? (gap.communitySlug ? `/communities/${gap.communitySlug}` : undefined),
    });
  }
  return undefined;
}

function estimateImpactAction(pool: DiscoverAction[], gap: TrendingValueGap): DiscoverAction | undefined {
  const preview = findActionMatching(pool, /split|preview|simulat/i);
  if (preview) return preview;
  if (!gap.communitySlug) return undefined;
  return synthAction(gap, "estimate-impact", "Estimate impact", "analyze", {
    communitySlug: gap.communitySlug,
  });
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

function consoleAction(pool: DiscoverAction[], gap: TrendingValueGap): DiscoverAction | undefined {
  const fromPool = findAction(pool, "console");
  if (fromPool) return fromPool;
  if (!gap.communitySlug) return undefined;
  const profile = getCommunityValueProfile(gap.communitySlug);
  const name = profile?.product ?? gap.communitySlug.replace(/-/g, " ");
  return synthAction(gap, "console", `Open ${name}`, "console", {
    communitySlug: gap.communitySlug,
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
    return { ...install, label: "Create community program" };
  }
  return findAction(pool, "connect_sensor") ?? profileConnectAction(gap);
}

function automateAction(gap: TrendingValueGap, pool: DiscoverAction[]): DiscoverAction | undefined {
  return findAction(pool, "automate") ?? buildAutomateActionForGap(gap) ?? undefined;
}

function agentAnalyzeAction(gap: TrendingValueGap, pool: DiscoverAction[]): DiscoverAction | undefined {
  return findAction(pool, "analyze") ?? buildAgentAnalyzeActionForGap(gap) ?? undefined;
}

function canClaimGap(
  gap: TrendingValueGap,
  connections: UserConnectionState | null | undefined,
): boolean {
  if (!connections?.signedIn) return false;
  if (!gap.amountVerified && !gap.proofAuthorizationId) return false;
  if (gap.domain === "oss" && !connections.githubUsername) return false;
  if (
    gap.domain === "music" &&
    !platformConnected(connections, "navidrome") &&
    !platformConnected(connections, "listenbrainz")
  ) {
    return false;
  }
  return gap.actions.some((a) => a.kind === "claim") || Boolean(gap.proofAuthorizationId);
}

type SlotContext = {
  gap: TrendingValueGap;
  pool: DiscoverAction[];
  connected: boolean;
  state: ReturnType<typeof getOpportunityState>;
  effectiveRole: DiscoverRole;
  push: (slot: DiscoverActionSlot) => void;
  fund: DiscoverAction;
  reward: DiscoverAction;
  rule: DiscoverAction;
  proof: DiscoverAction | undefined;
  claim: DiscoverAction;
  receipt: DiscoverAction | undefined;
  connect: DiscoverAction;
  estimate: DiscoverAction | undefined;
  mapIdentity: DiscoverAction | undefined;
  console: DiscoverAction | undefined;
  automate: DiscoverAction | undefined;
  agent: DiscoverAction | undefined;
};

function makePush(slots: DiscoverActionSlot[]) {
  return (slot: DiscoverActionSlot) => {
    if (slots.length >= MAX_SLOTS) return;
    const key = actionKey(slot.action);
    if (slots.some((s) => actionKey(s.action) === key)) return;
    slots.push(slot);
  };
}

function signedOutSlots(ctx: SlotContext) {
  ctx.push({
    action: ctx.fund,
    variant: "primary",
    disabled: true,
    disabledReason: "Sign in to continue",
  });
}

function terminalStates(ctx: SlotContext, connections: UserConnectionState | null | undefined): boolean {
  if (ctx.state === "claimable" && canClaimGap(ctx.gap, connections)) {
    ctx.push({ action: ctx.claim, variant: "primary" });
    if (ctx.proof) ctx.push({ action: ctx.proof, variant: "secondary" });
    return true;
  }

  if (ctx.state === "claimable") {
    ctx.push({
      action: ctx.claim,
      variant: "primary",
      disabled: true,
      disabledReason: "Only creator can claim",
    });
    if (ctx.proof) ctx.push({ action: ctx.proof, variant: "secondary" });
    return true;
  }

  if (ctx.state === "settled") {
    if (ctx.receipt) ctx.push({ action: ctx.receipt, variant: "primary" });
    else if (ctx.proof) ctx.push({ action: ctx.proof, variant: "primary" });
    return true;
  }

  return false;
}

/** Live Signals — react to proof; no create-program primaries. */
function resolveRadarsSlots(input: ActionResolveInput): DiscoverActionSlot[] {
  const slots: DiscoverActionSlot[] = [];
  const push = makePush(slots);

  const { gap, connections, role, signedIn, spendableUsd } = input;
  const pool = gap.actions;
  const connected = gap.communitySlug != null && communityReadyForDiscover(gap.communitySlug, connections);
  const state = getOpportunityState(gap, connected);
  const effectiveRole = role === "all" ? "operator" : role;

  const ctx: SlotContext = {
    gap,
    pool,
    connected,
    state,
    effectiveRole,
    push,
    fund: fundAction(pool, gap),
    reward: rewardAction(pool, gap),
    rule: ruleAction(pool, gap),
    proof: proofAction(pool, gap),
    claim: claimAction(pool, gap),
    receipt: receiptAction(pool, gap),
    connect: setupAction(pool, gap),
    estimate: estimateImpactAction(pool, gap),
    mapIdentity: mapIdentityAction(pool, gap),
    console: consoleAction(pool, gap),
    automate: automateAction(gap, pool),
    agent: agentAnalyzeAction(gap, pool),
  };

  if (!signedIn) {
    signedOutSlots(ctx);
    return slots;
  }

  if (terminalStates(ctx, connections)) return slots;

  if (state === "detected") {
    push({ action: ctx.connect, variant: "primary" });
    if (ctx.agent) {
      push({
        action: ctx.agent,
        variant: "secondary",
        disabled: true,
        disabledReason: "Connect source first",
      });
    }
    return slots;
  }

  if (state === "verified") {
    if (ctx.automate) push({ action: ctx.automate, variant: "primary" });
    else if (ctx.agent) push({ action: ctx.agent, variant: "primary" });
    else if (ctx.reward) push({ action: ctx.reward, variant: "primary", disabled: true, disabledReason: "Create a reward program in Unpaid Value first" });

    if (ctx.proof) push({ action: ctx.proof, variant: "secondary" });
    else if (ctx.mapIdentity) push({ action: ctx.mapIdentity, variant: "secondary" });
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
    } else if (ctx.automate) {
      push({ action: ctx.automate, variant: "primary" });
    } else {
      push({ action: ctx.reward, variant: "primary" });
    }
    if (ctx.agent && slots[0]?.action.kind !== "analyze") {
      push({ action: ctx.agent, variant: "secondary" });
    } else if (ctx.proof) {
      push({ action: ctx.proof, variant: "secondary" });
    }
    return slots;
  }

  // funded — reward + automate/agent
  push({ action: ctx.reward, variant: "primary" });
  if (ctx.automate) push({ action: ctx.automate, variant: "secondary" });
  else if (ctx.agent) push({ action: ctx.agent, variant: "secondary" });
  return slots;
}

/** Unpaid Value — create economies; fund pools; no manual scan primaries. */
function resolveGapsSlots(input: ActionResolveInput): DiscoverActionSlot[] {
  const slots: DiscoverActionSlot[] = [];
  const push = makePush(slots);

  const { gap, connections, role, signedIn, spendableUsd } = input;
  const pool = gap.actions;
  const connected = gap.communitySlug != null && communityReadyForDiscover(gap.communitySlug, connections);
  const state = getOpportunityState(gap, connected);
  const effectiveRole = role === "all" ? "founder" : role;

  const ctx: SlotContext = {
    gap,
    pool,
    connected,
    state,
    effectiveRole,
    push,
    fund: fundAction(pool, gap),
    reward: rewardAction(pool, gap),
    rule: ruleAction(pool, gap),
    proof: proofAction(pool, gap),
    claim: claimAction(pool, gap),
    receipt: receiptAction(pool, gap),
    connect: setupAction(pool, gap),
    estimate: estimateImpactAction(pool, gap),
    mapIdentity: mapIdentityAction(pool, gap),
    console: consoleAction(pool, gap),
    automate: automateAction(gap, pool),
    agent: agentAnalyzeAction(gap, pool),
  };

  if (!signedIn) {
    signedOutSlots(ctx);
    return slots;
  }

  if (terminalStates(ctx, connections)) return slots;

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
        disabledReason: "Reward program required first",
      });
      if (ctx.estimate) push({ action: ctx.estimate, variant: "secondary" });
      else if (ctx.proof) push({ action: ctx.proof, variant: "secondary" });
    } else {
      push({ action: ctx.rule, variant: "primary" });
      if (ctx.estimate) push({ action: ctx.estimate, variant: "secondary" });
      else if (ctx.fund) {
        push({
          action: { ...ctx.fund, label: "Fund initial pool" },
          variant: "secondary",
          disabled: spendableUsd != null && spendableUsd < 5,
          disabledReason: spendableUsd != null && spendableUsd < 5 ? "Add Arc USDC first" : undefined,
        });
      }
    }
    return slots;
  }

  if (state === "programmed") {
    const lowBalance = spendableUsd != null && spendableUsd < 5;
    push({
      action: { ...ctx.fund, label: "Fund initial pool" },
      variant: "primary",
      disabled: lowBalance,
      disabledReason: lowBalance ? "Add Arc USDC first" : undefined,
    });
    if (ctx.estimate) push({ action: ctx.estimate, variant: "secondary" });
    else if (ctx.proof) push({ action: ctx.proof, variant: "secondary" });
    return slots;
  }

  // funded
  push({ action: ctx.fund, variant: "primary" });
  if (ctx.estimate) push({ action: ctx.estimate, variant: "secondary" });
  else if (ctx.proof) push({ action: ctx.proof, variant: "secondary" });
  return slots;
}

/** Value graph board — fund gaps and open communities; creation lives in Unpaid Value. */
function resolveGraphSlots(input: ActionResolveInput): DiscoverActionSlot[] {
  const slots: DiscoverActionSlot[] = [];
  const push = makePush(slots);

  const { gap, connections, role, signedIn, spendableUsd } = input;
  const pool = gap.actions;
  const connected = gap.communitySlug != null && communityReadyForDiscover(gap.communitySlug, connections);
  const state = getOpportunityState(gap, connected);
  const effectiveRole = role === "all" ? "funder" : role;

  const ctx: SlotContext = {
    gap,
    pool,
    connected,
    state,
    effectiveRole,
    push,
    fund: fundAction(pool, gap, "Fund gap"),
    reward: rewardAction(pool, gap),
    rule: ruleAction(pool, gap),
    proof: proofAction(pool, gap),
    claim: claimAction(pool, gap),
    receipt: receiptAction(pool, gap),
    connect: setupAction(pool, gap),
    estimate: estimateImpactAction(pool, gap),
    mapIdentity: mapIdentityAction(pool, gap),
    console: consoleAction(pool, gap),
    automate: automateAction(gap, pool),
    agent: agentAnalyzeAction(gap, pool),
  };

  if (!signedIn) {
    signedOutSlots(ctx);
    return slots;
  }

  if (terminalStates(ctx, connections)) return slots;

  if (state === "detected") {
    if (ctx.console) push({ action: ctx.console, variant: "primary" });
    push({ action: ctx.connect, variant: "secondary" });
    return slots;
  }

  if (state === "verified") {
    if (ctx.console) push({ action: ctx.console, variant: "primary" });
    if (ctx.estimate) push({ action: ctx.estimate, variant: "secondary" });
    else if (ctx.agent) push({ action: ctx.agent, variant: "secondary" });
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
    if (ctx.console) push({ action: ctx.console, variant: "secondary" });
    return slots;
  }

  push({ action: ctx.fund, variant: "primary" });
  if (ctx.console) push({ action: ctx.console, variant: "secondary" });
  else if (ctx.proof) push({ action: ctx.proof, variant: "secondary" });
  return slots;
}

/** Learn / observe actions — never primary lane CTAs. */
export function resolveLaneAdvancedActions(
  input: ActionResolveInput,
  slots: DiscoverActionSlot[],
): DiscoverAction[] {
  const used = new Set(slots.map((s) => actionKey(s.action)));
  const { gap, lane } = input;
  const pool = gap.actions;
  const out: DiscoverAction[] = [];

  const pushCandidate = (action: DiscoverAction | undefined) => {
    if (!action || out.length >= MAX_ADVANCED) return;
    const key = actionKey(action);
    if (used.has(key) || out.some((a) => actionKey(a) === key)) return;
    out.push(action);
  };

  pushCandidate(proofAction(pool, gap));
  pushCandidate(mapIdentityAction(pool, gap));

  if (lane === "gaps") {
    pushCandidate(automateAction(gap, pool));
    pushCandidate(agentAnalyzeAction(gap, pool));
    pushCandidate(consoleAction(pool, gap));
  }

  if (lane === "radars") {
    pushCandidate(agentAnalyzeAction(gap, pool));
    pushCandidate(automateAction(gap, pool));
  }

  if (lane === "graph") {
    pushCandidate(agentAnalyzeAction(gap, pool));
    pushCandidate(automateAction(gap, pool));
  }

  for (const action of pool) {
    if (out.length >= MAX_ADVANCED) break;
    if (action.kind === "open" && /graph|explore ecosystem/i.test(action.label)) {
      pushCandidate(action);
    }
  }

  return out;
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
