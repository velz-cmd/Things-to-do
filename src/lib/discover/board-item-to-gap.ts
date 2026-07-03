import type { DiscoverBoardItem } from "@/lib/discover/opportunity-board";
import type { TrendingValueGap } from "@/lib/discover/types";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import { boardCommunityActions } from "@/lib/discover/board-actions-for-role";
import { getCommunityValueProfile } from "@/lib/discover/community-value-profiles";
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
    peopleImpacted: 0,
    trendScore: item.score,
    communitySlug: item.communitySlug,
    templateId: item.templateId,
    entityPath: `/communities/${item.communitySlug}`,
    productLabel: profile?.product,
    ecosystem: profile?.ecosystem,
    valueMetrics: {
      observedEvents: installed ? "Activity verified" : "Source not connected",
      payoutRules: "Rule missing",
      settlement: item.fundingGapUsd > 0 ? "Pool unfunded" : "Pool unfunded",
      verifiedSource: profile?.upstream ?? item.communityName,
    },
    actions,
    opportunityScorecard: item.opportunityScorecard,
  };
}
