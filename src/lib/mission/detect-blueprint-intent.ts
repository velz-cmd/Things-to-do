import { parseCapitalUsd } from "@/lib/mission/intents";
import { detectAgentSignalIntent } from "@/lib/mission/detect-agent-signal-intent";

const BLUEPRINT_VERBS =
  /\b(fund|allocate|simulate|distribution|maintainer|documentation bounty|citation payout|capital blueprint|fund (the )?top|prepare settlement|settlement package)\b/i;

/** Mission-native intents that open Blueprint — not generic chat. */
export function detectBlueprintIntent(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || detectAgentSignalIntent(trimmed)) return false;
  if (parseCapitalUsd(trimmed) != null) return true;
  return BLUEPRINT_VERBS.test(trimmed);
}
