import { parseCapitalUsd } from "@/lib/mission/intents";
import { detectAgentSignalIntent } from "@/lib/mission/detect-agent-signal-intent";

/** Operator batch payout from PDF / memo — Mission private pool only. */
export function detectPrivateBatchIntent(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return /\b(batch payout|pdf|upload|split between|allocate\s+\d|%\s+to|memo payout|custom pool|my community|board resolution|payroll)\b/i.test(
    t,
  );
}

/** View or fund communal pool — Discover owns deposits; Mission is read-only. */
export function detectCommunalPoolIntent(text: string): boolean {
  const t = text.trim();
  if (!t || detectAgentSignalIntent(t) || detectPrivateBatchIntent(t)) return false;
  if (/\b(fund|sponsor|contribute)\b/i.test(t) && parseCapitalUsd(t) != null) return true;
  return /\b(fund (the )?(top )?maintainers|communal pool|milestone|add to pool)\b/i.test(t);
}

const BLUEPRINT_VERBS =
  /\b(simulate allocation|capital blueprint|settlement package|prepare settlement|citation payout)\b/i;

const ROYALTY_SETTLEMENT =
  /\b(royalty settlement|royalty batch|play-weighted payee|prepare royalty|independent music artist)\b/i;

/** Mission Blueprint for settlement design / agent follow-on — not communal fund control. */
export function detectBlueprintIntent(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (detectCommunalPoolIntent(trimmed) || detectPrivateBatchIntent(trimmed)) return false;
  if (ROYALTY_SETTLEMENT.test(trimmed)) return true;
  if (
    /\b(settlement|settle)\b/i.test(trimmed) &&
    /\b(artist|music|royalt|play|listen)\b/i.test(trimmed)
  ) {
    return true;
  }
  if (parseCapitalUsd(trimmed) != null && /\b(simulate|blueprint|settlement)\b/i.test(trimmed)) {
    return true;
  }
  if (BLUEPRINT_VERBS.test(trimmed)) return true;
  if (detectAgentSignalIntent(trimmed)) return false;
  return false;
}
