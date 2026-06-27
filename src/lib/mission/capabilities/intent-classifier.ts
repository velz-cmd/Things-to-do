import type { CapabilityId } from "@/lib/mission/capabilities/types";
import { extractCommunityTargets } from "@/lib/mission/community";

const EXECUTE = /\b(execute on arc|authorize settlement|move money|send funds|settle now|review transaction|pay contributors)\b/i;
const EXPLAIN = /\b(why\b|explain|show evidence|show breakdown|detail|how did|what caused)\b/i;
const COMPARE = /\b(compare|vs\.?|versus|difference between|better than)\b/i;
const ALLOCATE = /\b(\$\d|allocate|who deserves|funding plan|grant round|distribut|i have \$|deploy \$)/i;
const CLAIM = /\b(claim|paid fairly|unclaimed|earnings|owed to me|getting paid)\b/i;
const RISK = /\b(risk|breaking|break|depend|critical|bus factor|maintainer disappear|downstream)\b/i;
const DISCOVER = /\b(leak|underfund|find value|discover|where is value|underfunded|value leak)\b/i;
const RESEARCH =
  /\b(analyze|research|audit|communities building|community scan|show me communities|governance|help linux|support independent music)\b/i;

/** Classify which economic capability the user is invoking. */
export function classifyCapability(
  question: string,
  priorMessages: { role: string; content: string }[] = [],
): CapabilityId {
  const text = question.trim();
  const lastUser = [...priorMessages].reverse().find((m) => m.role === "user");

  if (EXECUTE.test(text)) return "execute_settlement";
  if (EXPLAIN.test(text)) return "explain_evidence";
  if (COMPARE.test(text)) return "compare_ecosystems";
  if (ALLOCATE.test(text)) return "allocate_capital";
  if (CLAIM.test(text)) return "claim_value";
  if (RISK.test(text)) return "assess_risk";
  if (DISCOVER.test(text)) return "discover_value_leaks";
  if (RESEARCH.test(text)) return "research_ecosystem";

  if (lastUser && ALLOCATE.test(lastUser.content)) return "allocate_capital";
  if (lastUser && DISCOVER.test(lastUser.content)) return "discover_value_leaks";

  return "general_inquiry";
}

export const CAPABILITY_LABELS: Record<CapabilityId, string> = {
  discover_value_leaks: "Find value leaks",
  allocate_capital: "Allocate capital",
  compare_ecosystems: "Compare communities",
  assess_risk: "Assess community risk",
  claim_value: "Claim recognized value",
  research_ecosystem: "Research community",
  explain_evidence: "Explain evidence",
  execute_settlement: "Execute settlement",
  general_inquiry: "Community inquiry",
};

/** @deprecated use extractCommunityTargets from @/lib/mission/community */
export function extractCompareTargets(question: string): string[] {
  return extractCommunityTargets(question);
}

export function extractEcosystemScope(
  question: string,
  communityKeywords?: string[],
): string | null {
  const fromQuestion = extractCommunityTargets(question)[0];
  if (fromQuestion) return fromQuestion;
  if (communityKeywords?.[0]) return communityKeywords[0];
  return null;
}
