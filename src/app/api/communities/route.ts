import { NextResponse } from "next/server";
import { requireReadyUser } from "@/lib/auth/session";
import { listCommunitySummaries } from "@/lib/communities/surface";
import { getCommunitySensorStatuses } from "@/lib/sensors/status";
import { COMMUNITY_CATALOG } from "@/lib/communities/catalog";

const SENSOR_TIMEOUT_MS = 1_200;
const SUMMARY_TIMEOUT_MS = 4_000;

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
      observeNarrative: "Syncing value from your connected sources.",
      hasLiveData: false,
    },
    hubOps: null,
  }));
}

function communitiesJson(payload: Record<string, unknown>) {
  const response = NextResponse.json(payload);
  response.headers.set("Cache-Control", "private, max-age=15, stale-while-revalidate=120");
  return response;
}

export async function GET() {
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
      listCommunitySummaries(userId, { sensorStatuses: statuses, fast: true }),
      SUMMARY_TIMEOUT_MS,
      fallback,
    );
    return communitiesJson({
      ok: true,
      communities,
      sensorStatuses: statuses,
      degraded: communities === fallback || statuses.length === 0,
    });
  } catch (e) {
    console.error("[api/communities]", e);
    const communities = catalogFallback();
    const statuses = await withTimeout(
      getCommunitySensorStatuses().catch(() => []),
      SENSOR_TIMEOUT_MS,
      [],
    );
    return communitiesJson({ ok: true, communities, sensorStatuses: statuses, degraded: true });
  }
}
