import { getAgentSignalService, type AgentSignalService } from "./service-registry";

export function matchServiceForPrompt(prompt: string): AgentSignalService | null {
  const lower = prompt.toLowerCase();
  if (lower.includes("cve") || lower.includes("security") || lower.includes("advisory")) {
    return getAgentSignalService("security-signal") ?? null;
  }
  if (lower.includes("docs") || lower.includes("documentation") || lower.includes("readme")) {
    return getAgentSignalService("docs-review") ?? null;
  }
  if (lower.includes("maintainer") || lower.includes("react") || lower.includes("contributor")) {
    return getAgentSignalService("docs-review") ?? getAgentSignalService("sentiment-per-request") ?? null;
  }
  if (lower.includes("sentiment") || lower.includes("feedback") || lower.includes("classify")) {
    return getAgentSignalService("sentiment-per-request") ?? null;
  }
  if (lower.includes("research") || lower.includes("premium") || lower.includes("policy")) {
    return getAgentSignalService("premium-research") ?? null;
  }
  if (
    lower.includes("royalty") ||
    lower.includes("play-weighted") ||
    (lower.includes("settlement") && (lower.includes("music") || lower.includes("artist")))
  ) {
    return null;
  }
  if (
    (lower.includes("play") || lower.includes("listen") || lower.includes("artist")) &&
    /(?:artist|by|track|title|song)[:\s]+/i.test(prompt)
  ) {
    return getAgentSignalService("attribution-signal") ?? null;
  }
  if (
    lower.includes("citation") ||
    lower.includes("article") ||
    lower.includes("paper") ||
    lower.includes("doi")
  ) {
    return getAgentSignalService("citation-verify") ?? null;
  }
  return null;
}
