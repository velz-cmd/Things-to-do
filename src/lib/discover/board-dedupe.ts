import type { FundableOpportunity } from "@/lib/capital/community-yield";
import type { DiscoverBoardItem } from "@/lib/discover/opportunity-board";

/** One row per program — keep highest score when duplicates exist. */
export function dedupeFundablePrograms(programs: FundableOpportunity[]): FundableOpportunity[] {
  const byProgram = new Map<string, FundableOpportunity>();
  for (const p of programs) {
    const existing = byProgram.get(p.programId);
    if (!existing || p.score > existing.score) {
      byProgram.set(p.programId, p);
    }
  }

  const byCommunityTemplate = new Map<string, FundableOpportunity>();
  for (const p of byProgram.values()) {
    const key = `${p.communitySlug}::${p.templateId}`;
    const existing = byCommunityTemplate.get(key);
    if (!existing || p.score > existing.score) {
      byCommunityTemplate.set(key, p);
    }
  }

  return [...byCommunityTemplate.values()].sort((a, b) => b.score - a.score);
}

/** Board list — unique programs + unique community connect rows. */
export function dedupeDiscoverBoard(items: DiscoverBoardItem[]): DiscoverBoardItem[] {
  const programs = items.filter((i) => i.boardKind === "program") as Array<
    FundableOpportunity & { boardKind: "program" }
  >;
  const communities = items.filter((i) => i.boardKind === "community");

  const dedupedPrograms = dedupeFundablePrograms(programs).map((p) => ({
    ...p,
    boardKind: "program" as const,
  }));

  const seenCommunity = new Set<string>();
  const dedupedCommunities = communities.filter((c) => {
    if (seenCommunity.has(c.communitySlug)) return false;
    seenCommunity.add(c.communitySlug);
    return true;
  });

  return [...dedupedPrograms, ...dedupedCommunities].sort((a, b) => {
    const scoreA = "score" in a ? a.score : 0;
    const scoreB = "score" in b ? b.score : 0;
    return scoreB - scoreA;
  });
}
