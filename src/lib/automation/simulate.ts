import {
  type AutomationTrigger,
  AUTOMATION_TRIGGERS,
  getTriggerDef,
} from "./types";

export type AutomationSimulation = {
  trigger: AutomationTrigger;
  triggerLabel: string;
  authorizeUsd: number;
  eventType: string;
  connectorId: string;
  sampleEvents: number;
  projectedAuthorizeUsd: number;
  programTemplateId: string;
  notifyChannel: string;
  note: string;
};

export function simulateAutomationRule(input: {
  triggerEvent: AutomationTrigger;
  authorizeUsd: number;
  notifyChannel: string;
  sampleEvents?: number;
}): AutomationSimulation {
  const def = getTriggerDef(input.triggerEvent);
  const sampleEvents = Math.max(input.sampleEvents ?? 10, 1);
  const perEvent = input.authorizeUsd;
  return {
    trigger: input.triggerEvent,
    triggerLabel: def.label,
    authorizeUsd: perEvent,
    eventType: def.eventType,
    connectorId: def.connectorId,
    sampleEvents,
    projectedAuthorizeUsd: perEvent * sampleEvents,
    programTemplateId: def.programTemplateId,
    notifyChannel: input.notifyChannel,
    note:
      `When ${def.connectorId} emits ${def.eventType}, authorize $${perEvent} per ${def.billingUnit} ` +
      `and notify via ${input.notifyChannel}. Policy syncs to program ${def.programTemplateId}.`,
  };
}

export function defaultTriggerForCommunityKind(
  kind: string,
): AutomationTrigger {
  if (kind === "music") return "play";
  if (kind === "research") return "citation";
  if (kind === "media") return "view";
  return "docs_merge";
}

export function listTriggerOptions() {
  return AUTOMATION_TRIGGERS.map((t) => ({
    id: t.id,
    label: t.label,
    defaultAuthorizeUsd: t.defaultAuthorizeUsd,
    eventType: t.eventType,
    connectorId: t.connectorId,
  }));
}
