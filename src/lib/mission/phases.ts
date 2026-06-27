export type { ContextualAction } from "@/lib/mission/contextual-actions";
export { buildContextualActions, chipsFromFinding } from "@/lib/mission/contextual-actions";

export type MissionPhase = "discover" | "explain" | "plan" | "execute";

const PLAN =
  /\b(create.*(plan|funding)|funding plan|capital blueprint|design (a )?(grant|funding|treasury|policy)|distribution plan|build grant|simulate \$|let'?s fix|prepare allocat|draft allocat|build allocat|allocate to|fix\s+\w+|we have \$)\b/i;
const EXECUTE =
  /\b(execute on arc|authorize settlement|move money|send funds|settle now|review transaction|prepare settlement|create distribution|draft dao proposal|generate budget)\b/i;
const EXPLAIN =
  /\b(why\b|explain|show evidence|compare|who caused|who maintains|show breakdown|detail|how did)\b/i;

export function detectMissionPhase(
  text: string,
  priorMessages: { role: string; content: string }[] = [],
): MissionPhase {
  if (EXECUTE.test(text)) return "execute";
  if (PLAN.test(text)) return "plan";
  if (EXPLAIN.test(text)) return "explain";

  const lastUser = [...priorMessages].reverse().find((m) => m.role === "user");
  if (lastUser && PLAN.test(lastUser.content)) return "plan";

  return "discover";
}

export function shouldShowPlanningBar(phase: MissionPhase): boolean {
  return phase === "plan";
}

export function shouldShowExecuteBar(phase: MissionPhase): boolean {
  return phase === "execute";
}

