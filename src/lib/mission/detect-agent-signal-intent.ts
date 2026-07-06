import { matchServiceForPrompt } from "../agent/commerce-match";

const AGENT_SIGNAL_VERBS =
  /\b(run intel|run agent|buy signal|authorize signal|invoke signal|agent signal|classify sentiment|verify citation|docs review|security signal|cve extract|sentiment analysis)\b/i;

const SETTLEMENT_NOT_AGENT =
  /\b(royalty settlement|royalty batch|play-weighted payee|prepare royalty|settlement package|capital blueprint|simulate allocation)\b/i;

/** Route chat prompts that hire pay-per-signal agents to Mission agent flow. */
export function detectAgentSignalIntent(prompt: string): boolean {
  const trimmed = prompt.trim();
  if (!trimmed) return false;
  if (SETTLEMENT_NOT_AGENT.test(trimmed)) return false;
  if (
    /\b(settlement|settle)\b/i.test(trimmed) &&
    /\b(artist|music|royalt|play|listen)\b/i.test(trimmed)
  ) {
    return false;
  }
  if (AGENT_SIGNAL_VERBS.test(trimmed)) return true;
  if (/\b(fund|allocat|treasury|budget|grant|distribut|payout)\b/i.test(trimmed)) {
    return false;
  }
  if (matchServiceForPrompt(trimmed)) return true;
  return false;
}
