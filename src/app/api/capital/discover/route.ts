import { NextResponse } from "next/server";
import { listDiscoverOpportunityBoard } from "@/lib/discover/opportunity-board";
import { listCommunitiesNeedingFirstFunder } from "@/lib/capital/funder-discovery";

/** Public — programs any funder can discover without knowing communities */
export async function GET() {
  try {
    const [board, seedCommunities] = await Promise.all([
      listDiscoverOpportunityBoard(),
      listCommunitiesNeedingFirstFunder(),
    ]);
    const opportunities = board.filter((b) => b.boardKind === "program");
    const communityOpportunities = board.filter((b) => b.boardKind === "community");
    return NextResponse.json({
      ok: true,
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
    return NextResponse.json({ ok: true, opportunities: [], seedCommunities: [] });
  }
}
