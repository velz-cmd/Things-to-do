import { NextResponse } from "next/server";
import { requireReadyUser } from "@/lib/auth/session";
import { listCommunitySummaries } from "@/lib/communities/surface";
import { getCommunitySensorStatuses } from "@/lib/sensors/status";
import { COMMUNITY_CATALOG } from "@/lib/communities/catalog";
import { cacheGetOrSet } from "@/lib/cache/kv";
import { rateLimitHeaders } from "@/lib/api/cache-headers";
import { reportApiError } from "@/lib/api/report-error";
import { getRequestClientId, rateLimitRequest } from "@/lib/cache/rate-limit";

const SENSOR_TIMEOUT_MS = 1_500;
const SUMMARY_TIMEOUT_MS = 5_000;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      timer = setTimeout(() => resolve(fallback), ms);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function catalogFallback() {
  return COMMUNITY_CATALOG.map((c) => ({
    slug: c.slug,
    name: c.name,
    tagline: c.tagline,
    kind: c.kind,
    accent: c.accent,
    featured: c.featured,
    installCta: c.installCta,
    attachShape: c.attachShape,
    upstream: c.upstream,
    installed: false,
    vitals: {
      healthPct: null,
      healthLabel: "Observing",
      fundingTotalUsd: 0,
      fundingLabel: "Not synced",
      openWorkCount: 0,
      programCount: 0,
      topBuilders: [],
      sensor: { gated: false, live: true, ready: true, label: "Observing" },
      observeNarrative: "Loading metrics from your connected sources.",
      hasLiveData: false,
    },
    hubOps: null,
  }));
}

function communitiesJson(payload: Record<string, unknown>, extraHeaders?: Record<string, string>) {
  const response = NextResponse.json(payload);
  response.headers.set("Cache-Control", "private, max-age=15, stale-while-revalidate=120");
  if (extraHeaders) {
    for (const [key, value] of Object.entries(extraHeaders)) {
      response.headers.set(key, value);
    }
  }
  return response;
}

export async function GET(req: Request) {
  const rl = await rateLimitRequest(`communities:${getRequestClientId(req)}`, 80, 60);
  if (!rl.success) {
    const communities = catalogFallback();
    return communitiesJson(
      {
        ok: true,
        communities,
        sensorStatuses: [],
        degraded: true,
        rateLimited: true,
        metricsSyncing: true,
      },
      rateLimitHeaders(rl.remaining, rl.resetAt),
    );
  }

  try {
    const ready = await requireReadyUser();
    const userId = "error" in ready ? null : ready.user.id;
    const statuses = await withTimeout(
      getCommunitySensorStatuses().catch(() => []),
      SENSOR_TIMEOUT_MS,
      [],
    );
    const fallback = catalogFallback();
    const communities = await withTimeout(
      cacheGetOrSet(`communities:list:${userId ?? "guest"}`, 45, () =>
        listCommunitySummaries(userId, { sensorStatuses: statuses, fast: true }),
      ),
      SUMMARY_TIMEOUT_MS,
      fallback,
    );
    const usedFallback = communities === fallback;
    return communitiesJson({
      ok: true,
      communities,
      sensorStatuses: statuses,
      degraded: usedFallback,
      metricsSyncing: usedFallback && statuses.length === 0,
    });
  } catch (e) {
    reportApiError("communities", e);
    const communities = catalogFallback();
    const statuses = await withTimeout(
      getCommunitySensorStatuses().catch(() => []),
      SENSOR_TIMEOUT_MS,
      [],
    );
    return communitiesJson({ ok: true, communities, sensorStatuses: statuses, degraded: true });
  }
}
