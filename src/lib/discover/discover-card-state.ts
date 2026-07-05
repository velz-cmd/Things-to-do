import type { DiscoverAction, TrendingValueGap } from "@/lib/discover/types";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import type { UserConnectionState } from "@/lib/profile/connection-state-types";
import { communityReadyForDiscover } from "@/lib/discover/community-profile-link";
import { getCommunityValueProfile } from "@/lib/discover/community-value-profiles";
import {
  gapHasActiveRule,
  gapIsFunded,
  gapIsSettled,
  getOpportunityState,
  resolveDiscoverActionSlots,
  type DiscoverActionSlot,
  type OpportunityState,
} from "@/lib/discover/discover-opportunity-state";
import { resolveLaneAdvancedActions } from "@/lib/discover/discover-lane-slots";
import { enrichFundActionFromGap } from "@/lib/discover/discover-action-outcomes";
import {
  buildDiscoverCardNarrative,
  type DiscoverCardNarrative,
} from "@/lib/discover/discover-card-narrative";
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
  narrative: DiscoverCardNarrative;
  pipeline: PipelineStageState[];
  opportunityState: OpportunityState;
  actionSlots: DiscoverActionSlot[];
  advancedActions: DiscoverAction[];
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
  if (connected && !hasRule) return "No payout rule";
  if (connected) return "Activity verified";
  return "Proof found, payout rule missing";
}

function buildPipeline(
  connected: boolean,
  hasRule: boolean,
  funded: boolean,
  settled: boolean,
): PipelineStageState[] {
  if (settled) {
    return [
      { id: "extract", label: "Proof", status: "Verified", done: true, active: false },
      { id: "rule", label: "Program", status: "Settled on Arc", done: true, active: false },
      { id: "settle", label: "Receipt", status: "Available", done: true, active: false },
    ];
  }

  if (!connected) {
    return [
      { id: "extract", label: "Proof", status: "Source needed", done: false, active: true },
      { id: "rule", label: "Program", status: "Waiting", done: false, active: false },
      { id: "settle", label: "Settlement", status: "Blocked", done: false, active: false },
    ];
  }

  if (!hasRule) {
    return [
      { id: "extract", label: "Proof", status: "Verified", done: true, active: false },
      { id: "rule", label: "Program", status: "No payout rule", done: false, active: true },
      { id: "settle", label: "Settlement", status: "Blocked", done: false, active: false },
    ];
  }

  if (!funded) {
    return [
      { id: "extract", label: "Proof", status: "Verified", done: true, active: false },
      { id: "rule", label: "Program", status: "Active", done: true, active: false },
      { id: "settle", label: "Funding", status: "Needed", done: false, active: true },
    ];
  }

  return [
    {
      id: "extract",
      label: "Proof",
      status: "Verified",
      done: true,
      active: false,
    },
    {
      id: "rule",
      label: "Program",
      status: "Funded",
      done: true,
      active: false,
    },
    {
      id: "settle",
      label: "Settlement",
      status: "Ready to settle",
      done: false,
      active: true,
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
  options?: {
    signedIn?: boolean;
    spendableUsd?: number | null;
    poolBalanceUsd?: number;
    yourDepositUsd?: number;
  },
): DiscoverCardState {
  const profile = gap.communitySlug ? getCommunityValueProfile(gap.communitySlug) : null;
  const connected =
    gap.communitySlug != null && communityReadyForDiscover(gap.communitySlug, connections);
  const hasRule = gapHasActiveRule(gap);
  const livePoolUsd = Math.max(
    options?.poolBalanceUsd ?? 0,
    options?.yourDepositUsd ?? 0,
  );
  const funded = livePoolUsd > 0 || gapIsFunded(gap);
  const settled = gapIsSettled(gap);
  const opportunityState = getOpportunityState(gap, connected, {
    poolBalanceUsd: livePoolUsd,
  });

  const rawSlots = resolveDiscoverActionSlots({
    gap,
    connections,
    role,
    lane,
    signedIn: options?.signedIn ?? Boolean(connections?.signedIn),
    spendableUsd: options?.spendableUsd ?? null,
  });

  const actionSlots = rawSlots.map((slot) => ({
    ...slot,
    action: enrichFundActionFromGap(slot.action, gap),
  }));

  const slotInput = {
    gap,
    connections,
    role,
    lane,
    signedIn: options?.signedIn ?? Boolean(connections?.signedIn),
    spendableUsd: options?.spendableUsd ?? null,
  };

  const advancedActions = resolveLaneAdvancedActions(slotInput, actionSlots).map((action) =>
    enrichFundActionFromGap(action, gap),
  );

  const proofSource =
    gap.valueMetrics?.verifiedSource ??
    gap.proofSource ??
    profile?.upstream ??
    gap.productLabel ??
    "Connected sources";

  void surface;

  const narrative = buildDiscoverCardNarrative({
    gap,
    lane,
    proofSource,
    connected,
    hasRule,
    funded,
    settled,
    opportunityState,
  });

  return {
    title: gap.headline,
    proofSource,
    missingStep: connected && hasRule ? (funded ? "—" : "pool funding") : missingLabelForGap(gap),
    settlementStatus: settlementStatusLabel(connected, hasRule, funded, settled, gap),
    narrative,
    pipeline: buildPipeline(connected, hasRule, funded, settled),
    opportunityState,
    actionSlots,
    advancedActions,
  };
}
