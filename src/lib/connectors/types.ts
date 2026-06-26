/** Normalized event from any Distribution Connector → Settlement Core input. */
export type SettlementInputEvent = {
  connectorId: string;
  eventType: string;
  occurredAt: string;
  payeeKeys: { type: string; value: string; shareBps?: number }[];
  evidenceRefs: string[];
  amountUsd: number;
  rawMetadata?: unknown;
};

export type ConnectorMeta = {
  id: string;
  label: string;
  status: "live" | "demo" | "upcoming";
  description: string;
};

export const CONNECTOR_CATALOG: ConnectorMeta[] = [
  {
    id: "github",
    label: "GitHub",
    status: "live",
    description: "Pull requests, reviews, and repository attribution",
  },
  {
    id: "navidrome",
    label: "Navidrome",
    status: "demo",
    description: "Subsonic scrobble plays → per-listen authorization",
  },
  {
    id: "peertube",
    label: "PeerTube",
    status: "upcoming",
    description: "Plugin distribution via instance marketplace",
  },
  {
    id: "owncast",
    label: "Owncast",
    status: "upcoming",
    description: "Viewer presence webhooks",
  },
  {
    id: "jellyfin",
    label: "Jellyfin",
    status: "upcoming",
    description: "Playback webhook plugin",
  },
  {
    id: "rsshub",
    label: "RSSHub",
    status: "upcoming",
    description: "Citation toll at feed boundary",
  },
  {
    id: "mastodon",
    label: "Mastodon",
    status: "upcoming",
    description: "ActivityPub attributedTo settlement",
  },
];
