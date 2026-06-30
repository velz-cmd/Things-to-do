import { COMMUNITY_CATALOG } from "@/lib/communities/catalog";
import { listFundableOpportunities } from "@/lib/capital/funder-discovery";
import { scanAllOpportunities } from "@/lib/github/opportunities";
import { resolveCommunityForRepo } from "@/lib/discover/repo-community";
import type { FundableOpportunity } from "@/lib/capital/community-yield";
import { dedupeDiscoverBoard, dedupeFundablePrograms } from "@/lib/discover/board-dedupe";

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
    };

/** All real opportunities — programs plus catalog communities without duplicating trending caps. */
export async function listDiscoverOpportunityBoard(): Promise<DiscoverBoardItem[]> {
  const skipGithub = process.env.CI === "true";
  const [programs, ossScans] = await Promise.all([
    listFundableOpportunities(64),
    skipGithub ? Promise.resolve([]) : scanAllOpportunities().catch(() => []),
  ]);

  const items: DiscoverBoardItem[] = dedupeFundablePrograms(programs).map((p) => ({
    ...p,
    boardKind: "program" as const,
  }));
  const seenSlugs = new Set(programs.map((p) => p.communitySlug));

  for (const c of COMMUNITY_CATALOG.filter((x) => x.featured)) {
    if (seenSlugs.has(c.slug)) continue;
    const ossMatch = ossScans.find((o) => {
      const { communitySlug } = resolveCommunityForRepo(o.owner, o.repo);
      return communitySlug === c.slug;
    });
    const gapUsd = ossMatch?.health.fundingGapUsd ?? (c.kind === "music" ? 120 : 85);
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
      templateId: c.kind === "music" ? "user-centric-royalties" : "docs-bounty",
      templateLabel: c.attachShape === "index" ? "Ecosystem index" : "Sidecar",
      fundingGapUsd: gapUsd,
      whyFund: `${c.tagline} · via ${c.upstream}`,
      whoBenefits: c.doctrine.slice(0, 120),
      score: gapUsd * 0.5 + (c.featured ? 40 : 0),
      metricKind: c.attachShape === "sidecar" ? "install" : "connect",
      connectCta,
      connectHref: `/communities/${c.slug}`,
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
