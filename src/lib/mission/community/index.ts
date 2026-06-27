import type { CapabilityLayer, CommunityContext, CommunityKind } from "./types";
import { COMMUNITY_KIND_LABELS } from "./types";
import {
  detectCommunityKind,
  extractCommunityTargets,
  resolveCommunityName,
} from "./detector";
import { resolveSensors } from "./sensor-registry";

export function buildCommunityContext(input: {
  question: string;
  requiredLayers: CapabilityLayer[];
  community?: {
    name: string;
    kind?: string;
    keywords?: string[];
  };
}): CommunityContext {
  const kind = mapLegacyKind(input.community?.kind) ??
    detectCommunityKind({
      question: input.question,
      communityName: input.community?.name,
      keywords: input.community?.keywords,
    });

  const name = resolveCommunityName({
    question: input.question,
    communityName: input.community?.name,
    keywords: input.community?.keywords,
  });

  const keywords = [
    ...(input.community?.keywords ?? []),
    ...(name ? [name.toLowerCase()] : []),
  ];

  const compareTargets = extractCommunityTargets(input.question);
  const sensors = resolveSensors(kind, input.requiredLayers);

  return {
    kind,
    kindLabel: COMMUNITY_KIND_LABELS[kind],
    name,
    keywords,
    layersRequested: input.requiredLayers,
    sensors,
    compareTargets,
  };
}

function mapLegacyKind(kind?: string): CommunityKind | null {
  if (!kind) return null;
  const k = kind.toLowerCase();
  const map: Record<string, CommunityKind> = {
    project: "oss",
    protocol: "protocol",
    foundation: "oss",
    community: "general",
    organization: "general",
    dao: "dao",
    music: "music",
    research: "research",
    education: "education",
    local: "local",
    media: "media",
    oss: "oss",
  };
  return map[k] ?? null;
}

export { resolveSensors, layerEvidenceLabels, sensorEvidenceLabels, hasSensor } from "./sensor-registry";
export {
  detectCommunityKind,
  extractCommunityTargets,
  KNOWN_COMMUNITIES,
  communityKindLabel,
} from "./detector";
export { resolveCommunityRepoSignals } from "./repo-signals";
export type { CommunityRepoRef } from "./repo-signals";
export {
  MISSION_STARTER_GROUPS,
  followUpQuickActions,
  quickActionsForCommunity,
} from "./quick-actions";
export type {
  CommunityKind,
  CapabilityLayer,
  CommunityContext,
  SensorId,
  ResolvedSensor,
  DataSource,
} from "./types";
export { COMMUNITY_KIND_LABELS, LAYER_LABELS, LAYER_PURPOSE } from "./types";
