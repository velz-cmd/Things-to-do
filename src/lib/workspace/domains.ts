/** Map connector IDs to user-facing domains — connectors stay invisible in UI. */
export type ValueDomain =
  | "code"
  | "music"
  | "video"
  | "research"
  | "photos"
  | "documentation"
  | "feeds"
  | "other";

export const DOMAIN_LABELS: Record<ValueDomain, string> = {
  code: "Code",
  music: "Music",
  video: "Video",
  research: "Research",
  photos: "Photos",
  documentation: "Documentation",
  feeds: "Feeds",
  other: "Activity",
};

export function domainForConnector(connectorId: string): ValueDomain {
  switch (connectorId) {
    case "github":
      return "code";
    case "navidrome":
    case "jellyfin":
      return "music";
    case "peertube":
    case "owncast":
      return "video";
    case "openalex":
      return "research";
    case "rsshub":
    case "mastodon":
      return "feeds";
    default:
      return "other";
  }
}

export function domainLabel(connectorId: string): string {
  return DOMAIN_LABELS[domainForConnector(connectorId)];
}

/** Connected source — what users see instead of "connector". */
export type ConnectedSource = {
  id: string;
  label: string;
  domain: ValueDomain;
  connected: boolean;
  health: "live" | "waiting" | "soon";
};

export const SOURCE_CATALOG: Omit<ConnectedSource, "connected" | "health">[] = [
  { id: "github", label: "GitHub", domain: "code" },
  { id: "navidrome", label: "Music library", domain: "music" },
  { id: "peertube", label: "PeerTube", domain: "video" },
  { id: "owncast", label: "Owncast", domain: "video" },
  { id: "openalex", label: "Research", domain: "research" },
  { id: "rsshub", label: "RSS", domain: "feeds" },
  { id: "photos", label: "Photos", domain: "photos" },
];

export function reasonForAuthorizations(input: {
  domain: ValueDomain;
  count: number;
  connectorId: string;
  contextLabel?: string | null;
  metadata?: Record<string, unknown>;
}): string {
  const n = input.count;
  if (input.domain === "code") {
    const deps = input.metadata?.librariesIoDependents as number | undefined;
    if (deps) return `${deps.toLocaleString()} projects depend on this package`;
    return `${n} contribution${n === 1 ? "" : "s"} recognized`;
  }
  if (input.domain === "music") {
    const plays = input.metadata?.playCount as number | undefined;
    if (plays) return `${plays.toLocaleString()} listens verified`;
    return `${n} listen authorization${n === 1 ? "" : "s"}`;
  }
  if (input.domain === "research") {
    const cites = input.metadata?.openAlexCitations as number | undefined;
    if (cites) return `${cites.toLocaleString()} citations in the research graph`;
    return `${n} research signal${n === 1 ? "" : "s"}`;
  }
  if (input.contextLabel) return input.contextLabel;
  return `${n} authorization${n === 1 ? "" : "s"} recorded`;
}
