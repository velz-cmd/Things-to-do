import { generateTextWithFallback } from "@/lib/ai/gateway";
import { buildIntelligenceFindings } from "@/lib/workspace/advisors/intelligence-findings";
import { detectMissionIntent, parseCapitalUsd } from "@/lib/mission/intents";
import { detectMissionPhase } from "@/lib/mission/phases";
import type { AdvisorMessage } from "@/lib/workspace/advisors/synthesize";
import {
  classifyCapability,
  CAPABILITY_LABELS,
  extractCompareTargets,
} from "./capabilities/intent-classifier";
import { runCollectors } from "./capabilities/collectors";
import { buildGroundedAnswer } from "./capabilities/answer-builder";
import { getCapabilityDef } from "./capabilities/registry";
import type { CapabilityId, OrchestratorContext, OrchestratorResult } from "./capabilities/types";

function capabilityToIntent(capability: CapabilityId) {
  switch (capability) {
    case "allocate_capital":
      return "funding" as const;
    case "assess_risk":
      return "risk" as const;
    case "claim_value":
      return "claim" as const;
    case "discover_value_leaks":
      return "discovery" as const;
    default:
      return "general" as const;
  }
}

function filterFindingsForCapability(
  findings: ReturnType<typeof buildIntelligenceFindings>,
  capability: CapabilityId,
): ReturnType<typeof buildIntelligenceFindings> {
  switch (capability) {
    case "claim_value":
      return findings.filter((f) => f.id === "claimable-value" || f.id === "observation-gap");
    case "allocate_capital":
      return findings.filter((f) => f.id !== "observation-gap");
    case "assess_risk":
      return findings.filter((f) => f.id === "maintainer-risk" || f.id === "funding-gap");
    case "compare_ecosystems":
      return findings.filter((f) => f.id === "funding-gap" || f.id === "maintainer-risk");
    case "execute_settlement":
      return findings.filter((f) => f.id === "treasury-readiness" || f.id === "claimable-value");
    case "discover_value_leaks":
      return findings.filter((f) => f.id !== "treasury-readiness");
    default:
      return findings;
  }
}

async function maybeEnhanceWithReasoning(
  ctx: OrchestratorContext,
  groundedAnswer: string,
  messages?: AdvisorMessage[],
): Promise<string> {
  const needsLlm =
    ctx.capability === "explain_evidence" ||
    ctx.capability === "research_ecosystem" ||
    ctx.phase === "explain" ||
    (ctx.capability === "general_inquiry" && ctx.findings.length === 0);

  if (!needsLlm) return groundedAnswer;

  const history =
    messages?.length ?
      messages.map((m) => `${m.role === "user" ? "USER" : "ASSISTANT"}:\n${m.content}`).join("\n\n")
    : "";

  const facts = [
    `CAPABILITY: ${ctx.capabilityLabel}`,
    `GROUNDED FACTS (do not contradict):\n${groundedAnswer}`,
    ctx.findings.length ?
      `FINDINGS:\n${ctx.findings.map((f) => `- ${f.title}: ${f.insight}`).join("\n")}`
    : "",
    `API TRACE:\n${ctx.traces.map((t) => `- ${t.source}: ${t.summary}`).join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const { text } = await generateTextWithFallback({
      tier: "fast",
      system: `You are RESOLVE — economic OS for open ecosystems. Explain ONLY using GROUNDED FACTS and API TRACE. Never invent numbers. Max 100 words. No Approve/Execute unless user asked to move money.`,
      prompt: [history, facts, `USER:\n${ctx.question}`].filter(Boolean).join("\n\n"),
    });
    return text.trim() || groundedAnswer;
  } catch {
    return groundedAnswer;
  }
}

/** User message → intent → APIs → reasoning → actions. LLM is never step one. */
export async function runMissionOrchestrator(input: {
  question: string;
  messages?: AdvisorMessage[];
  ecosystem?: {
    name: string;
    keywords?: string[];
    repos?: Array<{ owner: string; repo: string; fullName: string }>;
    connectors?: string[];
  };
}): Promise<OrchestratorResult> {
  const capability = classifyCapability(input.question, input.messages ?? []);
  const phase = detectMissionPhase(input.question, input.messages ?? []);
  const def = getCapabilityDef(capability);

  const collected = await runCollectors({
    capability,
    question: input.question,
    ecosystem: input.ecosystem,
  });

  const intent = capabilityToIntent(capability);
  const allFindings = buildIntelligenceFindings(
    collected.evidence,
    input.question,
    intent,
  );
  const findings = filterFindingsForCapability(allFindings, capability);
  const capitalUsd = parseCapitalUsd(input.question);

  const ctx: OrchestratorContext = {
    question: input.question,
    capability,
    capabilityLabel: CAPABILITY_LABELS[capability],
    phase,
    evidence: collected.evidence,
    traces: collected.traces,
    opportunities: collected.opportunities,
    findings,
    policies: collected.policies,
    concentrations: collected.concentrations,
    opportunityCards: collected.opportunityCards,
    capitalUsd,
    compareTargets: collected.compareTargets.length ?
      collected.compareTargets
    : extractCompareTargets(input.question),
    ecosystemName: collected.ecosystemScope ?? input.ecosystem?.name,
    stepsRun: collected.stepsRun,
  };

  const groundedAnswer = buildGroundedAnswer(ctx);
  const answer = await maybeEnhanceWithReasoning(ctx, groundedAnswer, input.messages);
  const actions = def.actions(ctx);

  return {
    capability,
    capabilityLabel: CAPABILITY_LABELS[capability],
    phase,
    answer,
    headline: answer.split(".")[0] ?? answer,
    findings,
    actions,
    stepsRun: collected.stepsRun,
    traces: collected.traces,
    policies: collected.policies,
    opportunities: collected.opportunityCards,
    concentrations: collected.concentrations,
    grounded: true,
    requiresApproval: capability === "execute_settlement" || capability === "allocate_capital",
  };
}
