import type { DiscoverAction, TrendingValueGap } from "@/lib/discover/types";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import type { UserConnectionState } from "@/lib/profile/connection-state-types";
import { communityReadyForDiscover } from "@/lib/discover/community-profile-link";
import { getCommunityValueProfile } from "@/lib/discover/community-value-profiles";
import { discoverActionsForRole } from "@/lib/discover/discover-role-actions";
import { visibleDiscoverActions } from "@/lib/discover/discover-visible-actions";
import { tailorDiscoverActionsForUser } from "@/lib/discover/tailor-actions-for-user";

export type DiscoverCardLane = "gaps" | "radars" | "graph";

export type PipelineStageId = "extract" | "rule" | "settle";

export type PipelineStageState = {
  id: PipelineStageId;
  label: string;
  status: string;
  done: boolean;
  active: boolean;
};

export type DiscoverCardState = {
  title: string;
  proofSource: string;
  missingStep: string;
  settlementStatus: string;
  pipeline: PipelineStageState[];
  primaryActions: DiscoverAction[];
  advancedActions: DiscoverAction[];
};

const ADVANCED_KINDS = new Set<DiscoverAction["kind"]>(["console", "automate"]);
const EARNINGS_OPEN = /view earnings/i;

const LANE_KINDS: Record<DiscoverCardLane, Set<DiscoverAction["kind"]>> = {
  gaps: new Set(["fund", "create_program", "claim", "sponsor", "share", "install", "connect_sensor"]),
  radars: new Set(["connect_sensor", "analyze", "open", "create_program", "install"]),
  graph: new Set(["fund", "claim", "open", "share", "create_program", "sponsor"]),
};

function missingLabelForGap(gap: TrendingValueGap): string {
  const profile = gap.communitySlug ? getCommunityValueProfile(gap.communitySlug) : null;
  if (gap.templateId === "video-royalties") return "pay-per-minute rule";
  if (gap.templateId === "user-centric-royalties") return "royalty pool";
  if (gap.templateId === "citation-toll") return "citation toll";
  if (gap.templateId === "quadratic-funding") return "grant round";
  if (gap.templateId === "security-fund") return "security fund";
  if (gap.templateId === "docs-bounty") return "docs bounty";
  if (profile?.upstream) return `payout rule for ${profile.upstream.split(" · ")[0]}`;
  return "payout rule";
}

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

function settlementStatusLabel(
  connected: boolean,
  hasRule: boolean,
  funded: boolean,
  settled: boolean,
  gap: TrendingValueGap,
): string {
  if (settled) return "Settled on Arc";
  if (!connected) return "Source not connected";
  if (gap.amountVerified && gap.moneyCanMoveUsd > 0) return "Ready to settle";
  if (hasRule && !funded) return "Pool unfunded";
  if (connected && !hasRule) return "Rule missing";
  if (connected) return "Activity verified";
  return "Value detected";
}

function buildPipeline(
  connected: boolean,
  hasRule: boolean,
  funded: boolean,
  settled: boolean,
): PipelineStageState[] {
  const extractDone = connected;
  const ruleDone = hasRule;
  const settleDone = settled || funded;

  return [
    {
      id: "extract",
      label: "Extract",
      status: extractDone ? "Connected" : "Needed",
      done: extractDone,
      active: !extractDone,
    },
    {
      id: "rule",
      label: "Rule",
      status: ruleDone ? "Active" : "Missing",
      done: ruleDone,
      active: extractDone && !ruleDone,
    },
    {
      id: "settle",
      label: "Settle",
      status: settled ? "Settled" : funded ? "Funded" : "Not funded",
      done: settleDone,
      active: ruleDone && !settleDone,
    },
  ];
}

function filterEarningsActions(actions: DiscoverAction[], gap: TrendingValueGap): DiscoverAction[] {
  const claimable =
    gap.amountVerified &&
    gap.moneyCanMoveUsd > 0 &&
    (gap.actions.some((a) => a.kind === "claim") || gap.proofAuthorizationId);
  return actions.filter((a) => {
    if (a.kind === "claim") return claimable;
    if (EARNINGS_OPEN.test(a.label)) return claimable;
    return true;
  });
}

function pickStateAwarePrimary(
  actions: DiscoverAction[],
  gap: TrendingValueGap,
  connected: boolean,
  hasRule: boolean,
  funded: boolean,
  settled: boolean,
  lane: DiscoverCardLane,
): DiscoverAction[] {
  const byKind = (kind: DiscoverAction["kind"]) => actions.find((a) => a.kind === kind);
  const primary: DiscoverAction[] = [];

  if (!connected) {
    const connect = actions.find((a) => a.kind === "connect_sensor" || a.kind === "install");
    if (connect) primary.push(connect);
    if (lane === "radars") {
      const scan = byKind("analyze");
      if (scan && primary.length < 2) primary.push(scan);
    }
    return primary.slice(0, 3);
  }

  if (settled) {
    const receipt = actions.find((a) => a.kind === "share" || (a.kind === "open" && /proof|receipt/i.test(a.label)));
    if (receipt) primary.push(receipt);
    return primary.slice(0, 2);
  }

  const claim = byKind("claim");
  if (claim && gap.amountVerified && gap.moneyCanMoveUsd > 0) {
    primary.push(claim);
    return primary.slice(0, 2);
  }

  if (!hasRule) {
    const rule = byKind("create_program");
    if (rule) primary.push(rule);
    if (lane === "radars") {
      const scan = byKind("analyze");
      if (scan) primary.push(scan);
      const proof = actions.find((a) => a.kind === "open" && /proof/i.test(a.label));
      if (proof && primary.length < 3) primary.push(proof);
    }
    return primary.slice(0, 3);
  }

  if (!funded) {
    const fund = byKind("fund") ?? byKind("sponsor");
    if (fund) primary.push(fund);
    if (lane === "gaps" && primary.length < 2) {
      const preview = actions.find((a) => a.kind === "open" && /split|graph/i.test(a.label));
      if (preview) primary.push(preview);
    }
    return primary.slice(0, 3);
  }

  const fund = byKind("fund");
  if (fund && lane === "gaps") primary.push(fund);
  const proof = actions.find((a) => a.kind === "open");
  if (proof && primary.length < 3) primary.push(proof);

  return primary.slice(0, 3);
}

/** Structured card state — one story line, proof/missing/status, state-aware actions. */
export function deriveDiscoverCardState(
  gap: TrendingValueGap,
  connections: UserConnectionState | null | undefined,
  lane: DiscoverCardLane,
  role: DiscoverRole,
  surface: string,
): DiscoverCardState {
  const profile = gap.communitySlug ? getCommunityValueProfile(gap.communitySlug) : null;
  const connected =
    gap.communitySlug != null && communityReadyForDiscover(gap.communitySlug, connections);
  const hasRule = hasActiveRule(gap);
  const funded = isFunded(gap);
  const settled = isSettled(gap);

  const tailored = filterEarningsActions(
    tailorDiscoverActionsForUser(
      discoverActionsForRole(
        role,
        visibleDiscoverActions(gap.actions, surface).filter((a) => LANE_KINDS[lane].has(a.kind)),
      ),
      connections,
    ),
    gap,
  );

  const primaryActions = pickStateAwarePrimary(
    tailored,
    gap,
    connected,
    hasRule,
    funded,
    settled,
    lane,
  );
  const primaryIds = new Set(primaryActions.map((a) => a.id));

  const advancedActions = tailored.filter(
    (a) =>
      !primaryIds.has(a.id) &&
      (ADVANCED_KINDS.has(a.kind) ||
        (a.kind === "open" && /console|graph/i.test(a.label) && !primaryIds.has(a.id))),
  );

  const proofSource =
    gap.valueMetrics?.verifiedSource ??
    gap.proofSource ??
    profile?.upstream ??
    gap.productLabel ??
    "Connected sources";

  return {
    title: gap.headline,
    proofSource,
    missingStep: connected && hasRule ? (funded ? "—" : "pool funding") : missingLabelForGap(gap),
    settlementStatus: settlementStatusLabel(connected, hasRule, funded, settled, gap),
    pipeline: buildPipeline(connected, hasRule, funded, settled),
    primaryActions,
    advancedActions: advancedActions.slice(0, 4),
  };
}
