import { COMMUNITY_CATALOG, type CommunityCatalogEntry } from "@/lib/communities/catalog";
import { listFundableOpportunities } from "@/lib/capital/funder-discovery";
import type { FundableOpportunity } from "@/lib/capital/community-yield";
import { templateLabel } from "@/lib/capital/community-yield";
import { dedupeDiscoverBoard, dedupeFundablePrograms } from "@/lib/discover/board-dedupe";
import { classifyBoardNeedType } from "@/lib/discover/need-types";
import { getCommunityValueProfile } from "@/lib/discover/community-value-profiles";
import { buildOpportunityScorecard, scorecardFromFundable } from "@/lib/discover/opportunity-score";
import { withTimeout } from "@/lib/discover/fetch-timeout";

const PROGRAMS_TIMEOUT_MS = 5_000;

export type DiscoverBoardItem =
  | (FundableOpportunity & { boardKind: "program" })
  | {
      boardKind: "community";
      programId: string;
      programName: string;
      communitySlug: string;
      communityName: string;
      communityTagline: string;
      templateId: string;
      templateLabel: string;
      fundingGapUsd: number;
      whyFund: string;
      whoBenefits: string;
      score: number;
      metricKind: "connect" | "install";
      connectCta: string;
      connectHref: string;
      needType: import("@/lib/discover/need-types").DiscoverNeedType;
      opportunityScorecard?: import("@/lib/discover/opportunity-score").OpportunityScorecard;
    };

function templateForCommunity(c: CommunityCatalogEntry): string {
  if (c.kind === "music") return "user-centric-royalties";
  if (c.kind === "media") return "video-royalties";
  if (c.kind === "research") return "citation-toll";
  return "docs-bounty";
}

function exploreCtaForCommunity(c: CommunityCatalogEntry): string {
  const profile = getCommunityValueProfile(c.slug);
  return profile ? `Act on ${c.name}` : `Explore ${c.name}`;
}

function communityBoardRow(
  c: CommunityCatalogEntry,
  opts?: { gapUsd?: number; ossMatch?: boolean },
): DiscoverBoardItem {
  const gapUsd = opts?.gapUsd ?? 0;
  const templateId = templateForCommunity(c);
  const needType = classifyBoardNeedType({
    templateId,
    communitySlug: c.slug,
    boardKind: "community",
    metricKind: c.attachShape === "sidecar" ? "install" : "connect",
    whyFund: c.tagline,
    programName: c.name,
  });

  const hasScanGap = Boolean(opts?.ossMatch && gapUsd > 0);
  const opportunityScorecard = hasScanGap
    ? buildOpportunityScorecard({
        amountNeededUsd: gapUsd,
        amountVerified: false,
        amountKind: "estimate",
        dataSource: "github",
        templateId,
        domain: c.kind === "music" ? "music" : c.kind === "research" ? "research" : "oss",
        maintainerCount: 3,
        sensorGated: true,
        sensorLive: false,
        programCount: 0,
      })
    : undefined;

  const profile = getCommunityValueProfile(c.slug);
  const unpaidLine = profile?.unpaidSubtitle ?? c.tagline;

  return {
    boardKind: "community",
    programId: `community-${c.slug}`,
    programName: profile?.unpaidTitle ?? c.name,
    communitySlug: c.slug,
    communityName: c.name,
    communityTagline: unpaidLine,
    templateId,
    templateLabel: templateLabel(templateId),
    fundingGapUsd: gapUsd,
    whyFund: hasScanGap
      ? `${unpaidLine} · GitHub scan · est. $${gapUsd.toFixed(0)} maintainer gap`
      : `${unpaidLine} · Connect source to verify activity, then create a payout rule`,
    whoBenefits: c.doctrine.slice(0, 120),
    score: opportunityScorecard?.composite ?? 0,
    opportunityScorecard,
    metricKind: c.attachShape === "sidecar" ? "install" : "connect",
    connectCta: exploreCtaForCommunity(c),
    connectHref: `/communities/${c.slug}`,
    needType,
  };
}

/** Full catalog — instant fallback when program metrics time out. */
export function listDiscoverCommunityBoardFallback(): DiscoverBoardItem[] {
  return COMMUNITY_CATALOG.map((c) => communityBoardRow(c));
}

/** All real opportunities — programs plus sensor-live communities (no slow GitHub scan). */
export async function listDiscoverOpportunityBoard(): Promise<DiscoverBoardItem[]> {
  const programs = await withTimeout(listFundableOpportunities(16), PROGRAMS_TIMEOUT_MS, []);

  const items: DiscoverBoardItem[] = dedupeFundablePrograms(programs).map((p) => ({
    ...p,
    boardKind: "program" as const,
    opportunityScorecard: p.opportunityScorecard ?? scorecardFromFundable(p),
    score: p.opportunityScorecard?.composite ?? p.score,
    needType: classifyBoardNeedType({
      templateId: p.templateId,
      communitySlug: p.communitySlug,
      boardKind: "program",
      whyFund: p.whyFund,
      programName: p.programName,
    }),
  }));
  const seenSlugs = new Set(programs.map((p) => p.communitySlug));

  for (const c of COMMUNITY_CATALOG) {
    if (seenSlugs.has(c.slug)) continue;
    items.push(communityBoardRow(c));
    seenSlugs.add(c.slug);
  }

  return dedupeDiscoverBoard(
    items.sort((a, b) => {
      const scoreA = "score" in a ? a.score : 0;
      const scoreB = "score" in b ? b.score : 0;
      return scoreB - scoreA;
    }),
  );
}
