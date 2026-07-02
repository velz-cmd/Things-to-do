import type { DiscoverAction, TrendingValueGap } from "@/lib/discover/types";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import type { UserConnectionState } from "@/lib/profile/connection-state-types";
import { communityReadyForDiscover } from "@/lib/discover/community-profile-link";
import { getCommunityValueProfile } from "@/lib/discover/community-value-profiles";
import {
  getOpportunityState,
  resolveDiscoverActionSlots,
  type DiscoverActionSlot,
  type OpportunityState,
} from "@/lib/discover/discover-opportunity-state";
import type { DiscoverCardLane } from "@/lib/discover/types";

export type { DiscoverCardLane } from "@/lib/discover/types";
export type { DiscoverActionSlot, OpportunityState };

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
  opportunityState: OpportunityState;
  actionSlots: DiscoverActionSlot[];
  advancedActions: DiscoverAction[];
};

const ADVANCED_KINDS = new Set<DiscoverAction["kind"]>(["console", "automate"]);

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
  return "Proof found, payout rule missing";
}

function buildPipeline(
  connected: boolean,
  hasRule: boolean,
  funded: boolean,
  settled: boolean,
): PipelineStageState[] {
  return [
    {
      id: "extract",
      label: "Proof",
      status: connected ? "Connected" : "Needed",
      done: connected,
      active: !connected,
    },
    {
      id: "rule",
      label: "Rule",
      status: hasRule ? "Active" : "Missing",
      done: hasRule,
      active: connected && !hasRule,
    },
    {
      id: "settle",
      label: "Settle",
      status: settled ? "Settled" : funded ? "Funded" : "Unfunded",
      done: settled || funded,
      active: hasRule && !funded && !settled,
    },
  ];
}

/** Structured card state — proof, missing step, state machine, real action slots. */
export function deriveDiscoverCardState(
  gap: TrendingValueGap,
  connections: UserConnectionState | null | undefined,
  lane: DiscoverCardLane,
  role: DiscoverRole,
  surface: string,
  options?: { signedIn?: boolean; spendableUsd?: number | null },
): DiscoverCardState {
  const profile = gap.communitySlug ? getCommunityValueProfile(gap.communitySlug) : null;
  const connected =
    gap.communitySlug != null && communityReadyForDiscover(gap.communitySlug, connections);
  const hasRule = hasActiveRule(gap);
  const funded = isFunded(gap);
  const settled = isSettled(gap);
  const opportunityState = getOpportunityState(gap, connected);

  const actionSlots = resolveDiscoverActionSlots({
    gap,
    connections,
    role,
    lane,
    signedIn: options?.signedIn ?? Boolean(connections?.signedIn),
    spendableUsd: options?.spendableUsd ?? null,
  });

  const slotIds = new Set(actionSlots.map((s) => `${s.action.kind}:${s.action.id}`));
  const advancedActions = gap.actions.filter(
    (a) =>
      !slotIds.has(`${a.kind}:${a.id}`) &&
      ADVANCED_KINDS.has(a.kind),
  );

  const proofSource =
    gap.valueMetrics?.verifiedSource ??
    gap.proofSource ??
    profile?.upstream ??
    gap.productLabel ??
    "Connected sources";

  void surface;

  return {
    title: gap.headline,
    proofSource,
    missingStep: connected && hasRule ? (funded ? "—" : "pool funding") : missingLabelForGap(gap),
    settlementStatus: settlementStatusLabel(connected, hasRule, funded, settled, gap),
    pipeline: buildPipeline(connected, hasRule, funded, settled),
    opportunityState,
    actionSlots,
    advancedActions: advancedActions.slice(0, 3),
  };
}
