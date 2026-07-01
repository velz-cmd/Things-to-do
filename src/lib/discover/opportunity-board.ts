import { COMMUNITY_CATALOG, type CommunityCatalogEntry } from "@/lib/communities/catalog";
import { listFundableOpportunities } from "@/lib/capital/funder-discovery";
import { cachedScanAllOpportunities } from "@/lib/github/opportunity-cache";
import { resolveCommunityForRepo } from "@/lib/discover/repo-community";
import type { FundableOpportunity } from "@/lib/capital/community-yield";
import { templateLabel } from "@/lib/capital/community-yield";
import { dedupeDiscoverBoard, dedupeFundablePrograms } from "@/lib/discover/board-dedupe";
import { classifyBoardNeedType } from "@/lib/discover/need-types";
import { buildOpportunityScorecard, scorecardFromFundable } from "@/lib/discover/opportunity-score";
import { withTimeout } from "@/lib/discover/fetch-timeout";

const GITHUB_BOARD_SCAN_MS = 8_000;

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
  return `Explore ${c.name}`;
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

  const opportunityScorecard = buildOpportunityScorecard({
    amountNeededUsd: gapUsd,
    amountVerified: Boolean(opts?.ossMatch && gapUsd > 0),
    amountKind: opts?.ossMatch ? "estimate" : undefined,
    dataSource: opts?.ossMatch ? "github" : "community_catalog",
    templateId,
    domain: c.kind === "music" ? "music" : c.kind === "research" ? "research" : "oss",
    maintainerCount: opts?.ossMatch ? 3 : 0,
    sensorGated: true,
    sensorLive: false,
    programCount: 0,
  });

  return {
    boardKind: "community",
    programId: `community-${c.slug}`,
    programName: c.name,
    communitySlug: c.slug,
    communityName: c.name,
    communityTagline: c.tagline,
    templateId,
    templateLabel: templateLabel(templateId),
    fundingGapUsd: gapUsd,
    whyFund: opts?.ossMatch
      ? `${c.tagline} · GitHub scan · est. $${gapUsd.toFixed(0)} maintainer gap`
      : `${c.tagline} · install to surface verified needs as activity syncs`,
    whoBenefits: c.doctrine.slice(0, 120),
    score: opportunityScorecard.composite,
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

/** All real opportunities — programs plus every catalog community not already on a program row. */
export async function listDiscoverOpportunityBoard(): Promise<DiscoverBoardItem[]> {
  const skipGithub = process.env.CI === "true";
  const [programs, ossScans] = await Promise.all([
    withTimeout(listFundableOpportunities(32), 18_000, []),
    skipGithub
      ? Promise.resolve([])
      : withTimeout(cachedScanAllOpportunities().catch(() => []), GITHUB_BOARD_SCAN_MS, []),
  ]);

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
    const ossMatch = ossScans.find((o) => {
      const { communitySlug } = resolveCommunityForRepo(o.owner, o.repo);
      return communitySlug === c.slug;
    });
    const gapUsd = ossMatch?.health.fundingGapUsd ?? 0;
    items.push(
      communityBoardRow(c, {
        gapUsd,
        ossMatch: Boolean(ossMatch),
      }),
    );
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
