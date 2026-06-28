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

/** Incremental sensor sync on every tick — keeps Discover feed fresh. */
export async function refreshStaleSensors(): Promise<SensorMaintenanceResult> {
  const founderUserId = await resolveFounderUserId();
  const refreshed: SensorMaintenanceResult["refreshed"] = [];

  for (const slug of ["react", "linux"] as const) {
    const wasLive = await communityHasLiveSensorEvents(slug);
    const result = await syncGithubCommunitySensors({
      communitySlug: slug,
      founderUserId,
      includeSecurity: true,
    });
    refreshed.push({
      communitySlug: slug,
      wasLive,
      observations: result.observations,
      ingested: result.ingested,
      live: await communityHasLiveSensorEvents(slug),
    });
  }

  const researchWasLive = await communityHasLiveSensorEvents("open-research");
  const openAlexResult = await syncOpenAlexCommunitySensors({
    communitySlug: "open-research",
    founderUserId,
  });
  refreshed.push({
    communitySlug: "open-research",
    wasLive: researchWasLive,
    observations: openAlexResult.observations,
    ingested: openAlexResult.ingested,
    live: await communityHasLiveSensorEvents("open-research"),
  });

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
