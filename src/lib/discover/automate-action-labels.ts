import type { ProgramTemplateId } from "@/lib/communities/catalog";
import type { AutomationTrigger } from "@/lib/automation/types";
import { getTriggerDef } from "@/lib/automation/types";

/** Unique, user-facing automate CTA per template — no two programs share the same label. */
const TEMPLATE_AUTOMATE_LABELS: Partial<Record<ProgramTemplateId, string>> = {
  "docs-bounty": "Auto-pay on docs merge",
  "security-fund": "Auto-pay security reviewers",
  "user-centric-royalties": "Auto-pay per stream",
  "video-royalties": "Auto-pay per watch minute",
  "citation-toll": "Auto-pay on citation proof",
  "quadratic-funding": "Auto-release grant tranches",
};

const TRIGGER_AUTOMATE_LABELS: Record<AutomationTrigger, string> = {
  docs_merge: "Auto-pay on docs merge",
  play: "Auto-pay per play",
  citation: "Auto-pay on citation",
  view: "Auto-pay per watch",
};

const TEMPLATE_AUTOMATE_HINTS: Partial<Record<ProgramTemplateId, string>> = {
  "docs-bounty": "When a docs PR merges on GitHub → authorize USDC on Arc up to your cap",
  "security-fund": "When security work is verified → pay reviewers from your pool on Arc",
  "user-centric-royalties": "When ListenBrainz scrobbles a play → micro-pay artists on Arc",
  "video-royalties": "When Jellyfin logs a watch → pay creators per minute on Arc",
  "citation-toll": "When OpenAlex cites work → authorize citation toll on Arc",
  "quadratic-funding": "When grant votes finalize → release matching USDC on Arc",
};

export function automateLabelFor(input: {
  templateId?: string;
  automationTrigger?: AutomationTrigger;
}): string {
  if (input.automationTrigger) {
    return TRIGGER_AUTOMATE_LABELS[input.automationTrigger];
  }
  if (input.templateId && input.templateId in TEMPLATE_AUTOMATE_LABELS) {
    return TEMPLATE_AUTOMATE_LABELS[input.templateId as ProgramTemplateId]!;
  }
  return "Automate payouts on proof";
}

export function automateHintFor(input: {
  templateId?: string;
  automationTrigger?: AutomationTrigger;
}): string {
  if (input.templateId && input.templateId in TEMPLATE_AUTOMATE_HINTS) {
    return TEMPLATE_AUTOMATE_HINTS[input.templateId as ProgramTemplateId]!;
  }
  if (input.automationTrigger) {
    const def = getTriggerDef(input.automationTrigger);
    return `When ${def.label.toLowerCase()} (${def.connectorId}) → authorize USDC on Arc per ${def.billingUnit}`;
  }
  return "Pay automatically when verified activity arrives — capped on Arc";
}

export function defaultTriggerForTemplate(templateId?: string): AutomationTrigger {
  const map: Partial<Record<ProgramTemplateId, AutomationTrigger>> = {
    "docs-bounty": "docs_merge",
    "security-fund": "docs_merge",
    "user-centric-royalties": "play",
    "video-royalties": "view",
    "citation-toll": "citation",
    "quadratic-funding": "docs_merge",
  };
  if (templateId && templateId in map) {
    return map[templateId as ProgramTemplateId]!;
  }
  return "docs_merge";
}
