import { prisma } from "@/lib/db";
import { CONNECTOR_CATALOG } from "@/lib/connectors/types";
import { runIntegrationHealthCheck } from "@/lib/integrations/health";
import { isNavidromeConfigured } from "@/lib/integrations/navidrome";
import { isListenBrainzConfigured } from "@/lib/integrations/listenbrainz";

export type ConnectorLiveStatus = {
  id: string;
  label: string;
  description: string;
  catalogStatus: "live" | "demo" | "upcoming";
  installed: boolean;
  health: "healthy" | "waiting" | "offline" | "upcoming" | "syncing";
  eventsToday: number;
  authorizationVolumeUsd: number;
  authorizationCount: number;
  lastEventAt: string | null;
  docsPath: string | null;
};

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getConnectorLiveStatuses(): Promise<ConnectorLiveStatus[]> {
  const sinceToday = startOfToday();
  const health = await runIntegrationHealthCheck();

  const rows = await prisma.paymentAuthorization
    .groupBy({
      by: ["connectorId"],
      _count: { id: true },
      _sum: { amountUsd: true },
      _max: { updatedAt: true },
    })
    .catch(() => []);

  const todayRows = await prisma.paymentAuthorization
    .groupBy({
      by: ["connectorId"],
      _count: { id: true },
      where: { createdAt: { gte: sinceToday } },
    })
    .catch(() => []);

  const byConnector = new Map(rows.map((r) => [r.connectorId, r]));
  const todayByConnector = new Map(todayRows.map((r) => [r.connectorId, r._count.id]));

  return CONNECTOR_CATALOG.map((c) => {
    const stats = byConnector.get(c.id);
    const eventsToday = todayByConnector.get(c.id) ?? 0;
    const lastEventAt = stats?._max.updatedAt?.toISOString() ?? null;
    const githubOk = health.live.github?.ok ?? false;
    const navidromeApiOk = health.live.navidrome?.ok ?? false;
    const listenBrainzOk = health.live.listenBrainz?.ok ?? false;
    const musicSensorOk =
      navidromeApiOk || listenBrainzOk || isNavidromeConfigured() || isListenBrainzConfigured();

    const installed =
      c.id === "github" ? githubOk
      : c.id === "navidrome" ? musicSensorOk || (stats?._count.id ?? 0) > 0
      : c.status === "live" && (stats?._count.id ?? 0) > 0;

    let healthStatus: ConnectorLiveStatus["health"] = "upcoming";
    if (c.status === "upcoming") {
      healthStatus = "upcoming";
    } else if (c.id === "github") {
      healthStatus = githubOk ? (eventsToday > 0 || stats ? "healthy" : "waiting") : "offline";
    } else if (c.id === "navidrome") {
      if (stats?._count.id) healthStatus = "healthy";
      else if (navidromeApiOk || listenBrainzOk) healthStatus = "healthy";
      else if (musicSensorOk) healthStatus = "syncing";
      else healthStatus = "waiting";
    } else {
      healthStatus = c.status === "live" ? (stats ? "healthy" : "waiting") : "upcoming";
    }

    return {
      id: c.id,
      label: c.label,
      description: c.description,
      catalogStatus: c.status,
      installed,
      health: healthStatus,
      eventsToday,
      authorizationVolumeUsd: Math.round((stats?._sum.amountUsd ?? 0) * 100) / 100,
      authorizationCount: stats?._count.id ?? 0,
      lastEventAt,
      docsPath: c.id === "github" ? "/api/github/allocate" : c.id === "navidrome" ? "/api/connectors/navidrome/sync" : null,
    };
  });
}
