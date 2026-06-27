/**
 * RESOLVE thinks in communities and capability layers — not connectors.
 * Connectors/sensors are implementation details selected dynamically.
 */

export type CommunityKind =
  | "oss"
  | "music"
  | "research"
  | "education"
  | "local"
  | "protocol"
  | "dao"
  | "media"
  | "science"
  | "maps"
  | "wiki"
  | "general";

export type CapabilityLayer =
  | "observe"
  | "attribute"
  | "understand"
  | "capital"
  | "verify";

/** Implementation sensors — never shown as product identity. */
export type SensorId =
  | "github"
  | "npm"
  | "pypi"
  | "docker_hub"
  | "openalex"
  | "crossref"
  | "arxiv"
  | "musicbrainz"
  | "listenbrainz"
  | "navidrome"
  | "opencollective"
  | "discord"
  | "activitypub"
  | "mastodon"
  | "rss"
  | "openstreetmap"
  | "peertube"
  | "treasury"
  | "ledger"
  | "policies"
  | "concentrations"
  | "connectors"
  | "upstream";

/** Legacy collector trace keys — mapped from sensors for existing pipelines. */
export type DataSource =
  | "treasury"
  | "ledger"
  | "github"
  | "connectors"
  | "policies"
  | "concentrations"
  | "openalex"
  | "upstream"
  | "music"
  | "research";

export type ResolvedSensor = {
  id: SensorId;
  layer: CapabilityLayer;
  relevance: number;
  /** Human label for evidence artifacts — layer-first, not vendor-first */
  evidenceLabel: string;
  dataSource: DataSource;
};

export type CommunityContext = {
  kind: CommunityKind;
  kindLabel: string;
  name?: string;
  keywords: string[];
  layersRequested: CapabilityLayer[];
  sensors: ResolvedSensor[];
  compareTargets: string[];
};

export const COMMUNITY_KIND_LABELS: Record<CommunityKind, string> = {
  oss: "Open source",
  music: "Music & creative",
  research: "Research",
  education: "Open education",
  local: "Local communities",
  protocol: "Protocol",
  dao: "DAO & governance",
  media: "Media & video",
  science: "Open science",
  maps: "Maps & geodata",
  wiki: "Wiki & knowledge",
  general: "Open communities",
};

export const LAYER_LABELS: Record<CapabilityLayer, string> = {
  observe: "Observation",
  attribute: "Attribution",
  understand: "Understanding",
  capital: "Capital",
  verify: "Verification",
};

export const LAYER_PURPOSE: Record<CapabilityLayer, string> = {
  observe: "Can we observe this community?",
  attribute: "Who created value?",
  understand: "How does the ecosystem work?",
  capital: "Can money improve this?",
  verify: "Did it work?",
};
