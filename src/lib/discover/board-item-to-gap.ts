import type { DiscoverBoardItem } from "@/lib/discover/opportunity-board";
import type { TrendingValueGap } from "@/lib/discover/types";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import { boardCommunityActions } from "@/lib/discover/board-actions-for-role";
import {
  buildUnpaidValueMetrics,
  getCommunityValueProfile,
} from "@/lib/discover/community-value-profiles";
import { communityReadyForDiscover } from "@/lib/discover/community-profile-link";
import type { UserConnectionState } from "@/lib/profile/connection-state-types";

function domainForBoardItem(
  communitySlug: string,
  templateId: string,
): TrendingValueGap["domain"] {
  const profile = getCommunityValueProfile(communitySlug);
  if (profile?.ecosystem === "Research") return "research";
  if (profile?.ecosystem === "Music" || profile?.ecosystem === "Video") return "music";
  if (templateId === "quadratic-funding" || templateId === "citation-toll") return "dao";
  return "oss";
}

/** Convert Funding board community rows into gap cards for the state machine. */
export function boardCommunityItemToGap(
  item: Extract<DiscoverBoardItem, { boardKind: "community" }>,
  role: DiscoverRole,
  connections: UserConnectionState | null | undefined,
): TrendingValueGap {
  const profile = getCommunityValueProfile(item.communitySlug);
  const installed = communityReadyForDiscover(item.communitySlug, connections);
  const previewMetrics = buildUnpaidValueMetrics(item.communitySlug, installed);
  const payeeCount = previewMetrics.countValue || 0;
  const effectiveRole = role === "all" ? "funder" : role;
  const actions = boardCommunityActions(effectiveRole, {
    communitySlug: item.communitySlug,
    templateId: item.templateId,
    needType: item.needType,
    communityName: item.communityName,
    installed,
    connections,
  });

  return {
    id: item.programId,
    needType: item.needType,
    domain: domainForBoardItem(item.communitySlug, item.templateId),
    headline: profile?.unpaidTitle ?? item.programName,
    why: item.whyFund,
    whoBenefits: item.whoBenefits,
    proofSource: profile?.upstream ?? item.communityName,
    dataSource: "community_catalog",
    amountVerified: false,
    amountNeededUsd: item.fundingGapUsd,
    moneyCanMoveUsd: 0,
    peopleImpacted: payeeCount,
    trendScore: item.score,
    communitySlug: item.communitySlug,
    templateId: item.templateId,
    entityPath: `/communities/${item.communitySlug}`,
    productLabel: profile?.product,
    ecosystem: profile?.ecosystem,
    valueMetrics: {
      observedEvents: installed
        ? `${payeeCount} payees with verified activity`
        : "Source not connected",
      payoutRules: item.programName,
      settlement: item.fundingGapUsd > 0 ? "Funding needed" : "Ready to settle",
      verifiedSource: profile?.upstream ?? item.communityName,
      story:
        item.fundingGapUsd > 0
          ? `${payeeCount} payees are waiting for ${item.programName} to be funded.`
          : `${item.programName} is funded and ready for payout review.`,
      valueLabel: "Funding needed",
      countLabel: item.templateId === "user-centric-royalties" ? "Artists" : "Payees",
      countValue: payeeCount,
      confidence: previewMetrics.confidence || Math.round(item.score * 100),
      blocker: item.fundingGapUsd > 0 ? "Funding needed" : "Ready to settle",
      lastActivity: "updated recently",
      primarySubtext:
        item.fundingGapUsd > 0
          ? `Suggested first fund: $${Math.max(25, Math.min(item.fundingGapUsd, 250)).toLocaleString()}`
          : "Review payout queue",
    },
    actions,
    opportunityScorecard: item.opportunityScorecard,
  };
}
