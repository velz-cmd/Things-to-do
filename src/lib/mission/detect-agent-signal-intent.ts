import { matchServiceForPrompt } from "../agent/commerce-match";

const AGENT_SIGNAL_VERBS =
  /\b(run intel|run agent|buy signal|authorize signal|invoke signal|agent signal|classify sentiment|verify citation|docs review|security signal|cve extract|sentiment analysis)\b/i;

/** Route chat prompts that hire pay-per-signal agents to Mission agent flow. */
export function detectAgentSignalIntent(prompt: string): boolean {
  const trimmed = prompt.trim();
  if (!trimmed) return false;
  if (AGENT_SIGNAL_VERBS.test(trimmed)) return true;
  if (/\b(fund|allocat|treasury|budget|grant|distribut|payout|settle)\b/i.test(trimmed)) {
    return false;
  }
  if (matchServiceForPrompt(trimmed)) return true;
  return false;
}
