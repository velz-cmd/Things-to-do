import type { MissionPhase } from "@/lib/mission/phases";
import type { MissionFinding } from "@/lib/workspace/advisors/intelligence-findings";

export type ContextualAction = {
  label: string;
  prompt: string;
  kind: "explore" | "simulate" | "plan" | "execute" | "remember";
};

function shortRepoName(title: string): string {
  const parts = title.split("/");
  return parts.length > 1 ? parts[1]! : title;
}

/** Contextual next steps — emerge from conversation, never fixed Approve/Execute templates. */
export function buildContextualActions(input: {
  phase: MissionPhase;
  findings?: MissionFinding[];
  turnCount: number;
  lastUserText: string;
}): ContextualAction[] {
  const { phase, findings = [], turnCount, lastUserText } = input;
  const top = findings[0];
  const actions: ContextualAction[] = [];

  if (phase === "execute") {
    if (/\b(review|transaction|prepared)\b/i.test(lastUserText)) {
      actions.push({
        label: "Walk me through what moves",
        prompt: "Walk me through exactly what capital would move and who receives it.",
        kind: "execute",
      });
    }
    actions.push({
      label: "What happens after settlement?",
      prompt: "What happens across the ecosystem after this settlement completes?",
      kind: "explore",
    });
    return actions.slice(0, 3);
  }

  if (phase === "plan") {
    const target = top?.title ?? "this ecosystem";
    actions.push({
      label: "I've prepared a funding simulation",
      prompt: `Simulate allocation for ${target} — show tradeoffs without moving capital.`,
      kind: "simulate",
    });
    actions.push({
      label: "Compare three allocation philosophies",
      prompt: `Compare Protect Infrastructure, Reward Documentation, and Prioritize Small Maintainers for ${target}.`,
      kind: "explore",
    });
    if (turnCount >= 2) {
      actions.push({
        label: "Save this as a decision draft",
        prompt: `Save this allocation reasoning as a decision draft for ${target}.`,
        kind: "remember",
      });
    }
    return actions.slice(0, 3);
  }

  if (phase === "explain") {
    actions.push({
      label: "What breaks if we wait?",
      prompt: top ?
        `What breaks across the ecosystem if we delay action on ${top.title}?`
      : "What breaks if we wait on this?",
      kind: "explore",
    });
    if (top?.id === "maintainer-risk") {
      actions.push({
        label: "Who actually maintains this?",
        prompt: `Who maintains ${top.title} and what is their current activity level?`,
        kind: "explore",
      });
    }
    actions.push({
      label: "Compare to peer ecosystems",
      prompt: "How does this compare to similar ecosystems at the same scale?",
      kind: "explore",
    });
    return actions.slice(0, 3);
  }

  // discover — actions from findings, not templates
  if (top?.id === "treasury-readiness") {
    actions.push({
      label: "Show me the settlement tradeoff",
      prompt: "Explain the tradeoff between settling now vs waiting for more treasury.",
      kind: "explore",
    });
  }

  if (top?.id === "maintainer-risk") {
    const repo = shortRepoName(top.title);
    actions.push({
      label: `Map who depends on ${repo}`,
      prompt: `Map downstream communities that depend on ${top.title}.`,
      kind: "explore",
    });
    if (turnCount >= 2) {
      actions.push({
        label: "Prepare a maintainer rescue simulation",
        prompt: `Simulate what a focused maintainer rescue would look like for ${top.title}.`,
        kind: "simulate",
      });
    }
  }

  if (top?.id === "funding-gap") {
    actions.push({
      label: "Where would capital matter most?",
      prompt: "Rank where capital would have the highest impact across observed projects.",
      kind: "explore",
    });
    if (turnCount >= 2) {
      actions.push({
        label: "I've found a better allocation",
        prompt: "Propose an allocation that balances infrastructure risk and maintainer sustainability.",
        kind: "plan",
      });
    }
  }

  if (top?.id === "claimable-value") {
    actions.push({
      label: "Which ecosystems owe me value?",
      prompt: "Break down unclaimed value by ecosystem and contributor activity.",
      kind: "explore",
    });
  }

  if (top?.id === "observation-gap") {
    actions.push({
      label: "What am I not seeing?",
      prompt: "What economic signals might RESOLVE be missing right now?",
      kind: "explore",
    });
  }

  if (!actions.length && top) {
    actions.push({
      label: "Go deeper on this",
      prompt: `Explain the economic consequences of ${top.title} in more depth.`,
      kind: "explore",
    });
  }

  if (turnCount >= 3 && top && !actions.some((a) => a.kind === "plan")) {
    actions.push({
      label: "Turn this into a capital plan",
      prompt: `Turn our analysis of ${top.title} into a capital allocation plan.`,
      kind: "plan",
    });
  }

  return actions.slice(0, 3);
}

/** Per-finding chips — narrative, never Approve/Execute/Reject. */
export function chipsFromFinding(finding: MissionFinding): string[] {
  switch (finding.id) {
    case "treasury-readiness":
      return ["Explain the tradeoff", "What happens if we wait?"];
    case "maintainer-risk":
      return ["Why does this matter?", "Who maintains this?", "Map downstream risk"];
    case "funding-gap":
      return ["Where would capital matter most?", "Compare tradeoffs", "Show evidence"];
    case "observation-gap":
      return ["What am I not seeing?", "Why does this matter?"];
    case "claimable-value":
      return ["Break down by ecosystem", "Why unclaimed?"];
    default:
      return ["Why does this matter?", "Show evidence"];
  }
}
