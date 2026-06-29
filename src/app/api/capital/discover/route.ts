import { NextResponse } from "next/server";
import {
  listCommunitiesNeedingFirstFunder,
  listFundableOpportunities,
} from "@/lib/capital/funder-discovery";

/** Public — programs any funder can discover without knowing communities */
export async function GET() {
  try {
    const [opportunities, seedCommunities] = await Promise.all([
      listFundableOpportunities(24),
      listCommunitiesNeedingFirstFunder(),
    ]);
    return NextResponse.json({
      ok: true,
      opportunities,
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
