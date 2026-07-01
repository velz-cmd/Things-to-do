import type { CommunityCatalogEntry } from "@/lib/communities/catalog";
import type { ConnectorLiveStatus } from "@/lib/connectors/live-stats";
import type { CommunitySensorStatus } from "@/lib/sensors/catalog-visibility";

export type CommunityBuilderVital = {
  label: string;
  amountUsd: number;
};

const CONNECTOR_OBSERVE_LABELS: Record<string, string> = {
  github: "GitHub, contributors, and docs",
  navidrome: "Navidrome playback",
  listenbrainz: "ListenBrainz scrobbles",
  musicbrainz: "MusicBrainz attribution",
  jellyfin: "Jellyfin watches",
  openalex: "OpenAlex citations",
  crossref: "Crossref publications",
  opencollective: "Open Collective funding",
  discord: "Discord community signals",
  activitypub: "fediverse activity",
};

function connectorHealthScore(health: string): number {
  switch (health) {
    case "healthy":
      return 100;
    case "syncing":
      return 75;
    case "waiting":
      return 50;
    case "offline":
      return 15;
    case "upcoming":
      return 0;
    default:
      return 25;
  }
}

export function formatFundingLabel(usd: number, hasLiveData: boolean): string {
  if (!hasLiveData && usd <= 0) return "Not synced";
  if (usd <= 0) return "$0 in programs";
  return `$${usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function shortenPayee(payeeKey: string): string {
  const key = payeeKey.trim();
  if (key.startsWith("@")) return key;
  if (key.length <= 18) return key;
  return `${key.slice(0, 8)}…${key.slice(-6)}`;
}

export function buildObserveNarrative(
  community: Pick<CommunityCatalogEntry, "connectors" | "name">,
): string {
  const parts = community.connectors
    .map((id) => CONNECTOR_OBSERVE_LABELS[id] ?? id)
    .filter((v, i, arr) => arr.indexOf(v) === i);
  if (parts.length === 0) {
    return `RESOLVE will now observe upstream signals for ${community.name}.`;
  }
  const list =
    parts.length <= 2
      ? parts.join(" and ")
      : `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
  return `RESOLVE will now observe ${list}. Open work and funding surface in your console.`;
}

export function computeCommunityHealth(input: {
  connectors: string[];
  connectorStatuses: ConnectorLiveStatus[];
  sensor: CommunitySensorStatus;
  hasPrograms: boolean;
  hasOpenWork: boolean;
}): { healthPct: number | null; healthLabel: string } {
  const scores = input.connectors.map((id) => {
    const live = input.connectorStatuses.find((c) => c.id === id);
    return connectorHealthScore(live?.health ?? "unknown");
  });

  if (scores.length === 0 && !input.sensor.sensorGated) {
    return { healthPct: null, healthLabel: "No connectors" };
  }

  const connectorAvg =
    scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : 50;

  let sensorFactor = 1;
  if (input.sensor.sensorGated) {
    if (!input.sensor.sensorReady) sensorFactor = 0.35;
    else if (!input.sensor.sensorLive) sensorFactor = 0.55;
    else sensorFactor = 1;
  }

  let activityBonus = 0;
  if (input.hasOpenWork) activityBonus += 12;
  if (input.hasPrograms) activityBonus += 8;

  const raw = Math.min(100, Math.round(connectorAvg * sensorFactor + activityBonus));
  const healthPct = input.sensor.sensorGated && !input.sensor.sensorReady ? null : raw;

  let healthLabel = "Observing";
  if (input.sensor.sensorGated && !input.sensor.sensorReady) {
    healthLabel = input.sensor.message;
  } else if (input.sensor.sensorGated && !input.sensor.sensorLive) {
    healthLabel = "Awaiting sensor sync";
  } else if (raw >= 80) {
    healthLabel = "Healthy";
  } else if (raw >= 50) {
    healthLabel = "Warming up";
  } else if (raw > 0) {
    healthLabel = "Needs signal";
  } else {
    healthLabel = "No live signal";
  }

  return { healthPct, healthLabel };
}

export function topBuildersFromAuths(
  auths: Array<{ payeeKey: string; amountUsd: number }>,
  limit = 3,
): CommunityBuilderVital[] {
  const totals = new Map<string, number>();
  for (const a of auths) {
    totals.set(a.payeeKey, (totals.get(a.payeeKey) ?? 0) + a.amountUsd);
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([payeeKey, amountUsd]) => ({
      label: shortenPayee(payeeKey),
      amountUsd: Math.round(amountUsd * 100) / 100,
    }));
}
