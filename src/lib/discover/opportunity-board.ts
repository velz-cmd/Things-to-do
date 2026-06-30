import { COMMUNITY_CATALOG } from "@/lib/communities/catalog";
import { listFundableOpportunities } from "@/lib/capital/funder-discovery";
import { scanAllOpportunities } from "@/lib/github/opportunities";
import { resolveCommunityForRepo } from "@/lib/discover/repo-community";
import type { FundableOpportunity } from "@/lib/capital/community-yield";
import { dedupeDiscoverBoard, dedupeFundablePrograms } from "@/lib/discover/board-dedupe";
import { classifyBoardNeedType } from "@/lib/discover/need-types";
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
    };

/** Featured catalog communities — instant fallback when program metrics time out. */
export function listDiscoverCommunityBoardFallback(): DiscoverBoardItem[] {
  return COMMUNITY_CATALOG.filter((x) => x.featured).map((c) => {
    const templateId =
      c.kind === "music"
        ? "user-centric-royalties"
        : c.kind === "media"
          ? "video-royalties"
          : "docs-bounty";
    const needType = classifyBoardNeedType({
      templateId,
      communitySlug: c.slug,
      boardKind: "community",
      metricKind: c.attachShape === "sidecar" ? "install" : "connect",
      whyFund: c.tagline,
      programName: c.name,
    });
    const connectCta =
      c.connectors.includes("github")
        ? "Connect GitHub"
        : c.connectors.includes("jellyfin")
          ? "Connect Jellyfin"
          : c.connectors.includes("navidrome")
            ? "Connect Navidrome"
            : c.installCta;

    return {
      boardKind: "community" as const,
      programId: `community-${c.slug}`,
      programName: c.name,
      communitySlug: c.slug,
      communityName: c.name,
      communityTagline: c.tagline,
      templateId,
      templateLabel: c.attachShape === "index" ? "Ecosystem index" : "Sidecar",
      fundingGapUsd: 0,
      whyFund: `${c.tagline} · connect a sensor to surface verified needs`,
      whoBenefits: c.doctrine.slice(0, 120),
      score: c.featured ? 40 : 0,
      metricKind: c.attachShape === "sidecar" ? ("install" as const) : ("connect" as const),
      connectCta,
      connectHref: `/communities/${c.slug}`,
      needType,
    };
  });
}

/** All real opportunities — programs plus catalog communities without duplicating trending caps. */
export async function listDiscoverOpportunityBoard(): Promise<DiscoverBoardItem[]> {
  const skipGithub = process.env.CI === "true";
  const [programs, ossScans] = await Promise.all([
    withTimeout(listFundableOpportunities(32), 18_000, []),
    skipGithub
      ? Promise.resolve([])
      : withTimeout(scanAllOpportunities().catch(() => []), GITHUB_BOARD_SCAN_MS, []),
  ]);

  const items: DiscoverBoardItem[] = dedupeFundablePrograms(programs).map((p) => ({
    ...p,
    boardKind: "program" as const,
    needType: classifyBoardNeedType({
      templateId: p.templateId,
      communitySlug: p.communitySlug,
      boardKind: "program",
      whyFund: p.whyFund,
      programName: p.programName,
    }),
  }));
  const seenSlugs = new Set(programs.map((p) => p.communitySlug));

  for (const c of COMMUNITY_CATALOG.filter((x) => x.featured)) {
    if (seenSlugs.has(c.slug)) continue;
    const ossMatch = ossScans.find((o) => {
      const { communitySlug } = resolveCommunityForRepo(o.owner, o.repo);
      return communitySlug === c.slug;
    });
    const gapUsd = ossMatch?.health.fundingGapUsd ?? 0;
    const templateId =
      c.kind === "music"
        ? "user-centric-royalties"
        : c.kind === "media"
          ? "video-royalties"
          : "docs-bounty";
    const needType = classifyBoardNeedType({
      templateId,
      communitySlug: c.slug,
      boardKind: "community",
      metricKind: c.attachShape === "sidecar" ? "install" : "connect",
      whyFund: c.tagline,
      programName: c.name,
    });
    const connectCta =
      c.connectors.includes("github")
        ? "Connect GitHub"
        : c.connectors.includes("jellyfin")
          ? "Connect Jellyfin"
          : c.connectors.includes("navidrome")
            ? "Connect Navidrome"
            : c.installCta;

    items.push({
      boardKind: "community",
      programId: `community-${c.slug}`,
      programName: c.name,
      communitySlug: c.slug,
      communityName: c.name,
      communityTagline: c.tagline,
      templateId,
      templateLabel: c.attachShape === "index" ? "Ecosystem index" : "Sidecar",
      fundingGapUsd: gapUsd,
      whyFund: ossMatch
        ? `${c.tagline} · GitHub scan · est. $${gapUsd.toFixed(0)} maintainer gap`
        : `${c.tagline} · connect a sensor to surface verified needs (no estimate until live)`,
      whoBenefits: c.doctrine.slice(0, 120),
      score: gapUsd * 0.5 + (c.featured ? 40 : 0) + (ossMatch ? 20 : 0),
      metricKind: c.attachShape === "sidecar" ? "install" : "connect",
      connectCta,
      connectHref: `/communities/${c.slug}`,
      needType,
    });
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
