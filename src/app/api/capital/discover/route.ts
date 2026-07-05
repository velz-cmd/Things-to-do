import { API_CACHE } from "@/lib/api/cache-headers";
import { safeApiGet } from "@/lib/api/safe-route";
import {
  listDiscoverOpportunityBoard,
  listDiscoverCommunityBoardFallback,
} from "@/lib/discover/opportunity-board";
import { listCommunitiesNeedingFirstFunder } from "@/lib/capital/funder-discovery";
import { withTimeout } from "@/lib/discover/fetch-timeout";

export const maxDuration = 60;

const BOARD_TIMEOUT_MS = 6_000;
const BOARD_MAX_ITEMS = 24;

const BOARD_FALLBACK = {
  ok: true,
  degraded: true,
  opportunities: [] as unknown[],
  communityOpportunities: [] as unknown[],
  board: [] as unknown[],
  seedCommunities: [] as unknown[],
};

/** Public — programs any funder can discover without knowing communities */
export async function GET(req: Request) {
  return safeApiGet(
    req,
    async () => {
      const fallback = listDiscoverCommunityBoardFallback().slice(0, BOARD_MAX_ITEMS);
      let board = await withTimeout(listDiscoverOpportunityBoard(), BOARD_TIMEOUT_MS, fallback);
      if (!board.length) {
        board = fallback;
      }
      const degraded = board.every((b) => b.boardKind === "community");
      const seedCommunities = await withTimeout(
        listCommunitiesNeedingFirstFunder().catch(() => []),
        5_000,
        [],
      );
      const opportunities = board.filter((b) => b.boardKind === "program");
      const communityOpportunities = board.filter((b) => b.boardKind === "community");
      return {
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
      } as Record<string, unknown>;
    },
    {
      scope: "capital/discover",
      fallback: {
        ...BOARD_FALLBACK,
        communityOpportunities: listDiscoverCommunityBoardFallback().slice(0, BOARD_MAX_ITEMS),
        board: listDiscoverCommunityBoardFallback().slice(0, BOARD_MAX_ITEMS),
      } as Record<string, unknown>,
      cacheControl: API_CACHE.publicShort,
      rateLimit: { limit: 60, windowSeconds: 60, keyPrefix: "capital:discover" },
      redisCache: { key: "capital:discover:board", ttlSeconds: 45, staleSeconds: 135 },
    },
  );
}
