import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { loadDiscoverPageData } from "@/lib/discover/marketplace/query";

/**
 * TEMPORARY diagnostic route - traces why the SSR Pools view and the public
 * opportunities API disagreed on whether jellyfin's Pool is market-listed.
 * Not linked from any UI. Remove after the root cause is found.
 */
export async function GET() {
  const user = await getSessionUser().catch(() => null);
  const data = await loadDiscoverPageData({ sort: "newest" }, "activity");
  return NextResponse.json({
    userId: user?.id ?? null,
    poolsCount: data.pools.length,
    pools: data.pools.map((p) => ({
      id: p.id,
      name: p.name,
      communitySlug: p.communitySlug,
      lifecycleState: p.lifecycleState,
      publicationState: p.publicationState,
      policyState: p.policyState,
      treasuryReadiness: p.treasuryReadiness,
    })),
    opportunitiesCount: data.opportunities.items.length,
    opportunitiesTotal: data.opportunities.total,
    opportunityCommunityIds: [
      ...new Set(
        data.opportunities.items
          .filter((o) => o.marketplaceKind === "pool" || o.marketplaceKind === "program")
          .map((o) => o.community?.id),
      ),
    ],
  });
}
