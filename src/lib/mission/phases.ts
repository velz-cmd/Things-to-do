import type { MissionIntent } from "@/lib/mission/intents";
import type { MissionFinding } from "@/lib/workspace/advisors/intelligence-findings";

export type MissionPhase = "discover" | "explain" | "plan" | "execute";

const PLAN =
  /\b(create.*(plan|funding)|funding plan|let'?s fix|prepare allocat|draft allocat|build allocat|allocate to|fix\s+\w+)\b/i;
const EXECUTE =
  /\b(execute on arc|authorize settlement|move money|send funds|settle now|review transaction)\b/i;
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

/** Planning actions — only after user commits to fixing something. */
export function planningActions(finding?: MissionFinding): { label: string; prompt: string }[] {
  const target = finding?.title ?? "this issue";
  return [
    { label: "Create funding plan", prompt: `Create a funding plan for ${target}.` },
    { label: "Review contributors", prompt: `Show contributors behind ${target}.` },
    { label: "Simulate allocation", prompt: `Simulate allocation for ${target} without executing.` },
    { label: "Save draft", prompt: `Save this as a draft plan for ${target}.` },
  ];
}

export function executeActions(): { label: string; prompt: string }[] {
  return [
    { label: "Review transaction", prompt: "Review the prepared transaction before settlement." },
    { label: "Authorize settlement", prompt: "Authorize settlement on Arc." },
    { label: "Execute on Arc", prompt: "Execute the approved allocation on Arc." },
  ];
}

/** Card-level chips are generated from finding id + intent — not global templates. */
export function chipsFromFinding(finding: MissionFinding, intent: MissionIntent): string[] {
  if (intent === "discovery" && finding.id === "funding-gap") {
    return ["Why?", "Show evidence", "Compare impact", "Create funding plan"];
  }
  if (finding.id === "maintainer-risk") {
    return ["Why?", "Who maintains this?", "Show evidence", `Let's fix ${finding.title.split("/")[1] ?? finding.title}`];
  }
  return finding.chips;
}

/** Suggest plan entry only when user has explored enough — from conversation depth. */
export function suggestPlanEntry(
  turnCount: number,
  findings: MissionFinding[],
  lastUserText: string,
): string | null {
  if (/\b(fix|plan|allocat|fund)\b/i.test(lastUserText)) return null;
  if (turnCount < 2 || !findings.length) return null;
  const top = findings[0];
  if (!top) return null;
  if (top.id === "funding-gap" || top.id === "maintainer-risk") {
    return `Create funding plan for ${top.title}`;
  }
  return null;
}
