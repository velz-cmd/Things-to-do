export type MissionIntent = "funding" | "risk" | "claim" | "discovery" | "general";

const FUNDING = /\b(distribut|fund|allocat|\$\d|treasury|capital|invest|grant)\b/i;
const RISK = /\b(risk|breaking|break|depend|critical|burnout|disappear|affected)\b/i;
const CLAIM = /\b(claim|paid fairly|earnings|unclaimed|earning|owed)\b/i;
const DISCOVERY = /\b(leak|underfund|unpaid|deserve|opportunit|who powers|analyze|ecosystem)\b/i;

export function detectMissionIntent(text: string): MissionIntent {
  if (FUNDING.test(text)) return "funding";
  if (CLAIM.test(text)) return "claim";
  if (RISK.test(text)) return "risk";
  if (DISCOVERY.test(text)) return "discovery";
  return "general";
}

export function parseCapitalUsd(text: string): number | undefined {
  const m = text.match(/\$?\s*([\d,]+(?:\.\d+)?)\s*(k|K|m|M)?/);
  if (!m) return undefined;
  let n = Number(m[1].replace(/,/g, ""));
  if (Number.isNaN(n)) return undefined;
  if (m[2]?.toLowerCase() === "k") n *= 1000;
  if (m[2]?.toLowerCase() === "m") n *= 1_000_000;
  return n;
}

export function thinkingStepsFor(intent: MissionIntent): string[] {
  switch (intent) {
    case "funding":
      return [
        "Searching ecosystem",
        "Mapping dependencies",
        "Finding maintainers",
        "Detecting funding gaps",
        "Building allocation",
      ];
    case "risk":
      return [
        "Scanning dependencies",
        "Mapping blast radius",
        "Finding at-risk maintainers",
        "Estimating ecosystem impact",
        "Preparing recommendation",
      ];
    case "claim":
      return [
        "Scanning connected ecosystems",
        "Matching your contributions",
        "Calculating recognized value",
        "Checking claimable balance",
        "Preparing summary",
      ];
    case "discovery":
      return [
        "Observing open communities",
        "Mapping value flows",
        "Finding concentrations",
        "Comparing funding vs impact",
        "Synthesizing answer",
      ];
    default:
      return [
        "Gathering evidence",
        "Reasoning over the graph",
        "Preparing answer",
      ];
  }
}

export function shouldShowOpportunities(intent: MissionIntent): boolean {
  return intent === "funding" || intent === "risk" || intent === "discovery";
}

export function shouldShowExecution(intent: MissionIntent, text: string): boolean {
  if (intent === "funding") return true;
  if (intent === "claim" && /\b(claim|approve|execute)\b/i.test(text)) return true;
  if (/\b(approve|execute|simulate)\b/i.test(text)) return true;
  return false;
}

export function buildQuickReplies(intent: MissionIntent): string[] {
  switch (intent) {
    case "funding":
      return ["Why this split?", "Show evidence", "Customize allocations", "Simulate"];
    case "risk":
      return ["Show dependency graph", "Who maintains these?", "Recommend budget", "Show evidence"];
    case "claim":
      return ["Show breakdown", "Which ecosystems?", "Claim now", "View history"];
    case "discovery":
      return ["Who deserves funding?", "Show top gaps", "Allocate treasury", "Show evidence"];
    default:
      return ["Tell me more", "Show evidence", "What should I do next?", "Prepare action"];
  }
}

export const MISSION_EXAMPLES = [
  "I have $100k — who deserves it?",
  "Where is our ecosystem breaking?",
  "Am I getting paid fairly?",
  "Who depends on me?",
  "Find value leaks in React",
  "Where should grants go this quarter?",
] as const;
