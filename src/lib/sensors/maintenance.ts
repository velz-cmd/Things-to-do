import { prisma } from "@/lib/db";
import { bootstrapProductionSensors } from "@/lib/sensors/bootstrap";
import {
  communityHasLiveSensorEvents,
  syncGithubCommunitySensors,
  syncOpenAlexCommunitySensors,
} from "@/lib/sensors/sync";

const GATED_SLUGS = ["react", "linux", "open-research"] as const;

async function resolveFounderUserId(): Promise<string | undefined> {
  const founder = await prisma.resolveCommunityInstall.findFirst({
    orderBy: { installedAt: "asc" },
    select: { userId: true },
  });
  if (founder?.userId) return founder.userId;
  const user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  return user?.id;
}

export type SensorMaintenanceResult = {
  refreshed: Array<{
    communitySlug: string;
    wasLive: boolean;
    observations: number;
    ingested: number;
    live: boolean;
  }>;
  bootstrapped: boolean;
  bootstrap?: Awaited<ReturnType<typeof bootstrapProductionSensors>>;
  sensorLive: Record<string, boolean>;
};

/** Keep gated communities live — incremental sync, then bootstrap if ledger is still empty. */
export async function refreshStaleSensors(): Promise<SensorMaintenanceResult> {
  const founderUserId = await resolveFounderUserId();
  const refreshed: SensorMaintenanceResult["refreshed"] = [];

  for (const slug of ["react", "linux"] as const) {
    const wasLive = await communityHasLiveSensorEvents(slug);
    if (wasLive) {
      refreshed.push({
        communitySlug: slug,
        wasLive: true,
        observations: 0,
        ingested: 0,
        live: true,
      });
      continue;
    }

    const result = await syncGithubCommunitySensors({
      communitySlug: slug,
      founderUserId,
      includeSecurity: true,
    });
    refreshed.push({
      communitySlug: slug,
      wasLive: false,
      observations: result.observations,
      ingested: result.ingested,
      live: await communityHasLiveSensorEvents(slug),
    });
  }

  const researchWasLive = await communityHasLiveSensorEvents("open-research");
  if (!researchWasLive) {
    const result = await syncOpenAlexCommunitySensors({
      communitySlug: "open-research",
      founderUserId,
    });
    refreshed.push({
      communitySlug: "open-research",
      wasLive: false,
      observations: result.observations,
      ingested: result.ingested,
      live: await communityHasLiveSensorEvents("open-research"),
    });
  } else {
    refreshed.push({
      communitySlug: "open-research",
      wasLive: true,
      observations: 0,
      ingested: 0,
      live: true,
    });
  }

  const stillStale = await Promise.all(GATED_SLUGS.map((s) => communityHasLiveSensorEvents(s)));
  let bootstrapped = false;
  let bootstrap: SensorMaintenanceResult["bootstrap"];

  if (stillStale.some((live) => !live)) {
    bootstrap = await bootstrapProductionSensors({ userId: founderUserId });
    bootstrapped = true;
  }

  const sensorLive: Record<string, boolean> = {};
  for (const slug of GATED_SLUGS) {
    sensorLive[slug] = await communityHasLiveSensorEvents(slug);
  }

  return { refreshed, bootstrapped, bootstrap, sensorLive };
}
