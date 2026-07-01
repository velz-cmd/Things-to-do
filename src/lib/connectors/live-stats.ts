import { prisma } from "@/lib/db";
import { CONNECTOR_CATALOG } from "@/lib/connectors/types";
import {
  deriveConnectorHealthFlags,
  loadConnectorLedgerStats,
  mapConnectorLiveStatus,
  type ConnectorHealthMode,
} from "@/lib/connectors/ledger-stats";
import { getCachedIntegrationHealthCheck } from "@/lib/integrations/health-cache";

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

export type ConnectorLiveStatusOptions = {
  /** ledger = DB + env only (default). probe = admin health pings. */
  mode?: ConnectorHealthMode;
};

export async function getConnectorLiveStatuses(
  options: ConnectorLiveStatusOptions = {},
): Promise<ConnectorLiveStatus[]> {
  const mode = options.mode ?? "ledger";
  const { byConnector, todayByConnector } = await loadConnectorLedgerStats();

  let probed: { githubOk?: boolean; navidromeApiOk?: boolean; listenBrainzOk?: boolean } | undefined;
  if (mode === "probe") {
    const health = await getCachedIntegrationHealthCheck();
    probed = {
      githubOk: health.live.github?.ok ?? false,
      navidromeApiOk: health.live.navidrome?.ok ?? false,
      listenBrainzOk: health.live.listenBrainz?.ok ?? false,
    };
  }

  const flags = deriveConnectorHealthFlags(mode);

  return CONNECTOR_CATALOG.map((c) =>
    mapConnectorLiveStatus({
      catalog: c,
      stats: byConnector.get(c.id),
      eventsToday: todayByConnector.get(c.id) ?? 0,
      health: flags,
      probed,
    }),
  );
}
