import { NextResponse } from "next/server";
import { listDiscoverOpportunityBoard, listDiscoverCommunityBoardFallback } from "@/lib/discover/opportunity-board";
import { listCommunitiesNeedingFirstFunder } from "@/lib/capital/funder-discovery";
import { withTimeout } from "@/lib/discover/fetch-timeout";

export const maxDuration = 60;

const BOARD_TIMEOUT_MS = 25_000;

/** Public — programs any funder can discover without knowing communities */
export async function GET() {
  try {
    let board = await withTimeout(listDiscoverOpportunityBoard(), BOARD_TIMEOUT_MS, []);
    if (!board.length) {
      board = listDiscoverCommunityBoardFallback();
    }
    const degraded = board.every((b) => b.boardKind === "community");
    const seedCommunities = await withTimeout(
      listCommunitiesNeedingFirstFunder().catch(() => []),
      5_000,
      [],
    );
    const opportunities = board.filter((b) => b.boardKind === "program");
    const communityOpportunities = board.filter((b) => b.boardKind === "community");
    return NextResponse.json({
      ok: true,
      degraded,
      opportunities,
      communityOpportunities,
      board,
      seedCommunities: seedCommunities.map((c) => ({
        slug: c.slug,
        name: c.name,
        tagline: c.tagline,
        kind: c.kind,
      })),
    });
  } catch (e) {
    console.error("[capital/discover]", e);
    const board = listDiscoverCommunityBoardFallback();
    return NextResponse.json({
      ok: true,
      degraded: true,
      opportunities: [],
      communityOpportunities: board,
      board,
      seedCommunities: [],
    });
  }
}
