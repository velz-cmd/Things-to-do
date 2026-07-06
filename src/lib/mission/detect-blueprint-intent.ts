import { parseCapitalUsd } from "@/lib/mission/intents";
import { detectAgentSignalIntent } from "@/lib/mission/detect-agent-signal-intent";

/** Personal pool owner — PDF payee list, custom milestone, Arc batch (not Discover communal). */
export function detectPersonalPoolIntent(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return /\b(batch payout|personal pool|my pool|create (a )?pool|pdf|upload|split between|%\s+to|payroll|pay my (team|list)|private pool)\b/i.test(
    t,
  );
}

/** Fulfill a Discover communal pool — fund only; no simulation or allocation on Mission. */
export function detectFulfillPoolIntent(text: string): boolean {
  const t = text.trim();
  if (!t || detectAgentSignalIntent(t) || detectPersonalPoolIntent(t)) return false;
  if (/\b(most active|active pool|fulfill|fund (the )?pool|top pool|which pool)\b/i.test(t)) {
    return true;
  }
  if (/\b(fund|sponsor|contribute)\b/i.test(t) && parseCapitalUsd(t) != null) return true;
  return /\b(fund (the )?(top )?maintainers|communal pool|add to pool)\b/i.test(t);
}

/** @deprecated use detectPersonalPoolIntent */
export const detectPrivateBatchIntent = detectPersonalPoolIntent;

/** @deprecated use detectFulfillPoolIntent */
export const detectCommunalPoolIntent = detectFulfillPoolIntent;

const BLUEPRINT_VERBS =
  /\b(simulate allocation|capital blueprint|settlement package|prepare settlement|citation payout)\b/i;

/** Mission Blueprint for settlement design / agent follow-on — not pool control. */
export function detectBlueprintIntent(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || detectAgentSignalIntent(trimmed)) return false;
  if (detectFulfillPoolIntent(trimmed) || detectPersonalPoolIntent(trimmed)) return false;
  if (parseCapitalUsd(trimmed) != null && /\b(simulate|blueprint|settlement)\b/i.test(trimmed)) {
    return true;
  }
  return BLUEPRINT_VERBS.test(trimmed);
}
