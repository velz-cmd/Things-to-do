import { API_CACHE } from "@/lib/api/cache-headers";
import { safeApiGet } from "@/lib/api/safe-route";
import { getSessionUser } from "@/lib/auth/session";
import { buildLiveEvents } from "@/lib/events/live";

const EVENTS_FALLBACK = {
  degraded: true,
  ok: true,
  events: [] as unknown[],
  message: "Live events temporarily unavailable",
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const domain = searchParams.get("domain");
  const community = searchParams.get("community");
  const mission = searchParams.get("mission");
  const status = searchParams.get("status");
  const scope = searchParams.get("scope") === "mine" ? "mine" : "network";
  const limit = Number(searchParams.get("limit") ?? "24");
  const authUser = await getSessionUser();

  const cacheKey = `events:live:${scope}:${limit}:${domain ?? ""}:${community ?? ""}:${mission ?? ""}:${status ?? ""}:${authUser?.id ?? "guest"}`;

  return safeApiGet(
    req,
    () =>
      buildLiveEvents({
        limit: Number.isFinite(limit) ? limit : 24,
        domain: domain || null,
        communitySlug: community || null,
        missionId: mission || null,
        status: status || null,
        userId: authUser?.id ?? null,
        scope,
      }) as Promise<Record<string, unknown>>,
    {
      scope: "events/live",
      fallback: EVENTS_FALLBACK,
      cacheControl: API_CACHE.privateShort,
      rateLimit: { limit: 60, windowSeconds: 60, keyPrefix: "events:live", userId: authUser?.id },
      redisCache: { key: cacheKey, ttlSeconds: 30, staleSeconds: 90 },
    },
  );
}
