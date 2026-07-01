import type { ProgramTemplateId } from "@/lib/communities/catalog";

/** Sensor triggers tied to authorization ingest event types. */
export type AutomationTrigger = "docs_merge" | "play" | "citation" | "view";

export type AutomationNotifyChannel = "email" | "webhook";

export type AutomationTriggerDef = {
  id: AutomationTrigger;
  label: string;
  eventType: string;
  connectorId: string;
  billingUnit: string;
  defaultAuthorizeUsd: number;
  programTemplateId: ProgramTemplateId;
  ruleField: keyof import("@/lib/communities/types").ProgramRules;
};

export const AUTOMATION_TRIGGERS: AutomationTriggerDef[] = [
  {
    id: "docs_merge",
    label: "Docs merge",
    eventType: "contribution.merge",
    connectorId: "github",
    billingUnit: "merge",
    defaultAuthorizeUsd: 25,
    programTemplateId: "docs-bounty",
    ruleField: "perMergeUsd",
  },
  {
    id: "play",
    label: "Play",
    eventType: "scrobble.play",
    connectorId: "listenbrainz",
    billingUnit: "play",
    defaultAuthorizeUsd: 0.0004,
    programTemplateId: "user-centric-royalties",
    ruleField: "perPlayUsd",
  },
  {
    id: "citation",
    label: "Citation",
    eventType: "feed.cite",
    connectorId: "openalex",
    billingUnit: "citation",
    defaultAuthorizeUsd: 0.05,
    programTemplateId: "citation-toll",
    ruleField: "perCitationUsd",
  },
  {
    id: "view",
    label: "View",
    eventType: "video.watch",
    connectorId: "jellyfin",
    billingUnit: "view",
    defaultAuthorizeUsd: 0.002,
    programTemplateId: "video-royalties",
    ruleField: "perWatchUsd",
  },
];

export type AutomationRuleRecord = {
  id: string;
  installId: string;
  programId: string | null;
  communitySlug: string;
  name: string;
  triggerEvent: AutomationTrigger;
  authorizeUsd: number;
  notifyChannel: AutomationNotifyChannel;
  notifyTarget: string;
  enabled: boolean;
  lastFiredAt: string | null;
  lastFiredMeta: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export function getTriggerDef(trigger: AutomationTrigger): AutomationTriggerDef {
  const def = AUTOMATION_TRIGGERS.find((t) => t.id === trigger);
  if (!def) throw new Error(`Unknown trigger: ${trigger}`);
  return def;
}

export function triggerForIngestEvent(input: {
  connectorId: string;
  eventType: string;
}): AutomationTrigger | null {
  const match = AUTOMATION_TRIGGERS.find(
    (t) => t.connectorId === input.connectorId && t.eventType === input.eventType,
  );
  return match?.id ?? null;
}
