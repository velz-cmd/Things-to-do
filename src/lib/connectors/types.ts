export type { SettlementInputEvent } from "@/lib/authorization/types";

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
    description: "Contribution attribution from repository analysis",
  },
  {
    id: "navidrome",
    label: "Navidrome",
    status: "live",
    description: "Subsonic scrobble plays → per-listen Authorization",
  },
  {
    id: "openalex",
    label: "OpenAlex",
    status: "live",
    description: "Research citations → micropayment authorizations (RFB #2)",
  },
  {
    id: "peertube",
    label: "PeerTube",
    status: "upcoming",
    description: "Distribution Connector via instance plugin marketplace",
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
    status: "live",
    description: "Sessions API → video.watch authorizations (self-hosted video)",
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
    description: "ActivityPub attributedTo Authorization",
  },
];
