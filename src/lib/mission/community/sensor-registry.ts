import type {
  CapabilityLayer,
  CommunityKind,
  ResolvedSensor,
  SensorId,
} from "./types";
import { LAYER_LABELS } from "./types";

type SensorDef = {
  id: SensorId;
  evidenceLabel: string;
  /** Which community kinds this sensor is relevant for (empty = all) */
  communities: CommunityKind[] | "*";
};

const SENSOR: Record<SensorId, SensorDef> = {
  github: { id: "github", evidenceLabel: "Code activity", communities: ["oss", "protocol", "local", "general"] },
  npm: { id: "npm", evidenceLabel: "Package registry", communities: ["oss", "protocol", "general"] },
  pypi: { id: "pypi", evidenceLabel: "Python ecosystem", communities: ["oss", "research", "science", "general"] },
  docker_hub: { id: "docker_hub", evidenceLabel: "Container usage", communities: ["oss", "protocol"] },
  openalex: { id: "openalex", evidenceLabel: "Research graph", communities: ["research", "science", "education"] },
  crossref: { id: "crossref", evidenceLabel: "Citation metadata", communities: ["research", "science", "education"] },
  arxiv: { id: "arxiv", evidenceLabel: "Preprint corpus", communities: ["research", "science"] },
  musicbrainz: { id: "musicbrainz", evidenceLabel: "MusicBrainz credits", communities: ["music"] },
  listenbrainz: { id: "listenbrainz", evidenceLabel: "Listen history", communities: ["music"] },
  navidrome: { id: "navidrome", evidenceLabel: "Self-hosted library", communities: ["music"] },
  opencollective: { id: "opencollective", evidenceLabel: "Collective funding", communities: ["oss", "local", "dao", "education", "general"] },
  discord: { id: "discord", evidenceLabel: "Community chat", communities: ["oss", "dao", "local", "media", "general"] },
  activitypub: { id: "activitypub", evidenceLabel: "Fediverse activity", communities: ["media", "local", "wiki", "general"] },
  mastodon: { id: "mastodon", evidenceLabel: "Fediverse posts", communities: ["media", "local"] },
  rss: { id: "rss", evidenceLabel: "Publication feeds", communities: ["media", "education", "wiki", "research"] },
  openstreetmap: { id: "openstreetmap", evidenceLabel: "Open map data", communities: ["maps", "local"] },
  peertube: { id: "peertube", evidenceLabel: "Video instances", communities: ["media", "education"] },
  treasury: { id: "treasury", evidenceLabel: "Treasury state", communities: "*" },
  ledger: { id: "ledger", evidenceLabel: "Authorization ledger", communities: "*" },
  policies: { id: "policies", evidenceLabel: "Allocation policies", communities: "*" },
  concentrations: { id: "concentrations", evidenceLabel: "Value concentration", communities: "*" },
  connectors: { id: "connectors", evidenceLabel: "Live sensors", communities: "*" },
  upstream: { id: "upstream", evidenceLabel: "Dependency graph", communities: ["oss", "protocol", "research"] },
};

/** Layer → default sensor priority order (global fallback). */
const LAYER_SENSORS: Record<CapabilityLayer, SensorId[]> = {
  observe: [
    "connectors",
    "github",
    "npm",
    "pypi",
    "openalex",
    "arxiv",
    "listenbrainz",
    "navidrome",
    "musicbrainz",
    "opencollective",
    "discord",
    "activitypub",
    "rss",
    "openstreetmap",
    "peertube",
    "upstream",
  ],
  attribute: ["ledger", "connectors", "listenbrainz", "github", "openalex"],
  understand: ["concentrations", "policies", "upstream", "openalex", "crossref"],
  capital: ["treasury", "github", "opencollective", "concentrations", "policies"],
  verify: ["ledger", "treasury", "connectors"],
};

/** Community-specific boosts — sensors ranked higher for this kind. */
const COMMUNITY_SENSOR_BOOST: Partial<Record<CommunityKind, Partial<Record<SensorId, number>>>> = {
  oss: { github: 100, npm: 90, pypi: 85, opencollective: 70, upstream: 80 },
  music: { musicbrainz: 100, listenbrainz: 95, navidrome: 90, opencollective: 60 },
  research: { openalex: 100, crossref: 95, arxiv: 90, pypi: 70 },
  education: { openalex: 85, rss: 80, opencollective: 75, peertube: 70 },
  local: { opencollective: 90, discord: 85, openstreetmap: 80, github: 60 },
  protocol: { github: 90, npm: 85, docker_hub: 80, upstream: 85 },
  dao: { opencollective: 90, discord: 85, github: 70 },
  media: { peertube: 95, activitypub: 90, mastodon: 85, rss: 80 },
  science: { openalex: 100, arxiv: 95, crossref: 90, pypi: 75 },
  maps: { openstreetmap: 100, github: 50 },
  wiki: { rss: 85, activitypub: 80, github: 60 },
  general: { connectors: 100, github: 70, opencollective: 65, openalex: 60 },
};

function sensorToDataSource(id: SensorId): ResolvedSensor["dataSource"] {
  switch (id) {
    case "github":
    case "npm":
    case "pypi":
    case "docker_hub":
      return "github";
    case "openalex":
    case "crossref":
    case "arxiv":
      return "openalex";
    case "upstream":
      return "upstream";
    case "listenbrainz":
    case "navidrome":
    case "musicbrainz":
      return "music";
    case "treasury":
      return "treasury";
    case "ledger":
      return "ledger";
    case "policies":
      return "policies";
    case "concentrations":
      return "concentrations";
    default:
      return "connectors";
  }
}

function appliesToCommunity(def: SensorDef, kind: CommunityKind): boolean {
  return def.communities === "*" || def.communities.includes(kind);
}

function relevanceScore(kind: CommunityKind, layer: CapabilityLayer, sensorId: SensorId, index: number): number {
  const boost = COMMUNITY_SENSOR_BOOST[kind]?.[sensorId] ?? 0;
  const layerList = LAYER_SENSORS[layer];
  const layerRank = layerList.indexOf(sensorId);
  const position = layerRank >= 0 ? 100 - layerRank : 10 - index;
  return boost + position;
}

/** Resolve ranked sensors for community kind + capability layers. */
export function resolveSensors(
  kind: CommunityKind,
  layers: CapabilityLayer[],
): ResolvedSensor[] {
  const seen = new Set<SensorId>();
  const resolved: ResolvedSensor[] = [];

  for (const layer of layers) {
    const candidates = LAYER_SENSORS[layer]
      .filter((id) => {
        const def = SENSOR[id];
        return def && appliesToCommunity(def, kind);
      })
      .map((id, index) => ({
        id,
        layer,
        relevance: relevanceScore(kind, layer, id, index),
        evidenceLabel: `${LAYER_LABELS[layer]} · ${SENSOR[id].evidenceLabel}`,
        dataSource: sensorToDataSource(id),
      }))
      .sort((a, b) => b.relevance - a.relevance);

    for (const c of candidates) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      resolved.push(c);
    }
  }

  return resolved.sort((a, b) => b.relevance - a.relevance);
}

export function layerEvidenceLabels(sensors: ResolvedSensor[]): string[] {
  const labels = new Set<string>();
  for (const s of sensors) {
    labels.add(LAYER_LABELS[s.layer]);
  }
  return [...labels];
}

export function sensorEvidenceLabels(sensors: ResolvedSensor[], limit = 6): string[] {
  return sensors.slice(0, limit).map((s) => s.evidenceLabel);
}

export function hasSensor(sensors: ResolvedSensor[], id: SensorId): boolean {
  return sensors.some((s) => s.id === id);
}

export function sensorsForLayer(sensors: ResolvedSensor[], layer: CapabilityLayer): ResolvedSensor[] {
  return sensors.filter((s) => s.layer === layer);
}
