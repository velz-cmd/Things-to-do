import { prisma } from "@/lib/db";
import { INTEGRATIONS } from "@/lib/integrations/config";
import { isListenBrainzConfigured } from "@/lib/integrations/listenbrainz";
import { isNavidromeConfigured } from "@/lib/integrations/navidrome";
import type { ConnectorLiveStatus } from "@/lib/connectors/live-stats";

export type ConnectorHealthMode = "ledger" | "probe";

type HealthFlags = {
  githubOk: boolean;
  navidromeApiOk: boolean;
  listenBrainzOk: boolean;
};

/** Ledger + env config only — no external pings (user-facing routes). */
export function deriveConnectorHealthFlags(mode: ConnectorHealthMode): HealthFlags {
  if (mode === "probe") {
    return {
      githubOk: false,
      navidromeApiOk: false,
      listenBrainzOk: false,
    };
  }
  return {
    githubOk: INTEGRATIONS.github(),
    navidromeApiOk: isNavidromeConfigured(),
    listenBrainzOk: isListenBrainzConfigured(),
  };
}

export async function loadConnectorLedgerStats() {
  const sinceToday = new Date();
  sinceToday.setHours(0, 0, 0, 0);

  const [rows, todayRows] = await Promise.all([
    prisma.paymentAuthorization
      .groupBy({
        by: ["connectorId"],
        _count: { id: true },
        _sum: { amountUsd: true },
        _max: { updatedAt: true },
      })
      .catch(() => []),
    prisma.paymentAuthorization
      .groupBy({
        by: ["connectorId"],
        _count: { id: true },
        where: { createdAt: { gte: sinceToday } },
      })
      .catch(() => []),
  ]);

  return {
    byConnector: new Map(rows.map((r) => [r.connectorId, r])),
    todayByConnector: new Map(todayRows.map((r) => [r.connectorId, r._count.id])),
  };
}

export function mapConnectorLiveStatus(input: {
  catalog: {
    id: string;
    label: string;
    description: string;
    status: "live" | "demo" | "upcoming";
  };
  stats?: {
    _count: { id: number };
    _sum: { amountUsd: number | null };
    _max: { updatedAt: Date | null };
  };
  eventsToday: number;
  health: HealthFlags;
  probed?: {
    githubOk?: boolean;
    navidromeApiOk?: boolean;
    listenBrainzOk?: boolean;
  };
}): ConnectorLiveStatus {
  const c = input.catalog;
  const stats = input.stats;
  const eventsToday = input.eventsToday;
  const githubOk = input.probed?.githubOk ?? input.health.githubOk;
  const navidromeApiOk = input.probed?.navidromeApiOk ?? input.health.navidromeApiOk;
  const listenBrainzOk = input.probed?.listenBrainzOk ?? input.health.listenBrainzOk;
  const musicSensorOk =
    navidromeApiOk || listenBrainzOk || isNavidromeConfigured() || isListenBrainzConfigured();

  const installed =
    c.id === "github"
      ? githubOk || (stats?._count.id ?? 0) > 0
      : c.id === "openalex"
        ? (stats?._count.id ?? 0) > 0 || INTEGRATIONS.openAlex()
        : c.id === "navidrome"
          ? musicSensorOk || (stats?._count.id ?? 0) > 0
          : c.status === "live" && (stats?._count.id ?? 0) > 0;

  let healthStatus: ConnectorLiveStatus["health"] = "upcoming";
  if (c.status === "upcoming") {
    healthStatus = "upcoming";
  } else if (c.id === "github") {
    healthStatus = githubOk ? (eventsToday > 0 || stats ? "healthy" : "waiting") : "offline";
  } else if (c.id === "openalex") {
    healthStatus =
      (stats?._count.id ?? 0) > 0
        ? "healthy"
        : INTEGRATIONS.openAlex()
          ? "waiting"
          : "offline";
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
    lastEventAt: stats?._max.updatedAt?.toISOString() ?? null,
    docsPath:
      c.id === "github"
        ? "/api/github/allocate"
        : c.id === "navidrome"
          ? "/api/connectors/navidrome/sync"
          : c.id === "openalex"
            ? "/api/connectors/openalex/sync"
            : null,
  };
}
