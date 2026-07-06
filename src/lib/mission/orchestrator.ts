import { generateTextWithFallback, listConfiguredProviders } from "@/lib/ai/gateway";
import { withTimeout } from "@/lib/mission/with-timeout";
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
import { buildIntelligenceBrief } from "./intelligence-brief";
import { buildMissionReport } from "./mission-report";
import { getCapabilityDef } from "./capabilities/registry";
import { followUpQuickActions } from "./community/quick-actions";
import {
  buildCapitalBlueprint,
  contextualMissionActions,
  designCapitalSetupPills,
  detectCapitalLoopPhase,
  detectMissionJob,
  detectOperatingMode,
} from "./capital-os";
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
  fast?: boolean,
): Promise<string> {
  if (fast) return groundedAnswer;
  const ai = listConfiguredProviders();
  const hasAi = ai.gemini || ai.groq || ai.openrouter;
  const hasLiveEvidence =
    ctx.traces.some((t) => t.status === "ok") ||
    ctx.opportunities.length > 0 ||
    (ctx.researchReferences?.length ?? 0) > 0;

  const needsLlm =
    hasAi &&
    hasLiveEvidence &&
    (ctx.capability === "explain_evidence" ||
      ctx.capability === "general_inquiry" ||
      ctx.capability === "discover_value_leaks" ||
      ctx.capability === "allocate_capital" ||
      ctx.capability === "research_ecosystem" ||
      ctx.capability === "compare_ecosystems");

  if (!needsLlm) return groundedAnswer;

  const history =
    messages?.length ?
      messages.map((m) => `${m.role === "user" ? "USER" : "ASSISTANT"}:\n${m.content}`).join("\n\n")
    : "";

  const facts = [
    `CAPABILITY: ${ctx.capabilityLabel}`,
    `COMMUNITY: ${ctx.communityName ?? ctx.community.name ?? ctx.community.kindLabel}`,
    `GROUNDED FACTS (do not contradict):\n${groundedAnswer}`,
    ctx.opportunities.length ?
      `OBSERVED SIGNALS:\n${ctx.opportunities
        .slice(0, 4)
        .map(
          (o) =>
            `- ${o.fullName}: ${o.stars.toLocaleString()} stars, ${o.health.maintainerCount} maintainer(s), $${Math.round(o.health.fundingGapUsd).toLocaleString()} gap`,
        )
        .join("\n")}`
    : "",
    ctx.findings.length ?
      `FINDINGS:\n${ctx.findings.map((f) => `- ${f.title}: ${f.insight}`).join("\n")}`
    : "",
    `API TRACE:\n${ctx.traces.map((t) => `- ${t.source}: ${t.summary}`).join("\n")}`,
    ctx.researchReferences?.length ?
      `REFERENCES:\n${ctx.researchReferences
        .slice(0, 3)
        .map((r) => `- ${r.title} (${r.provider})`)
        .join("\n")}`
    : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const { text } = await withTimeout(
      generateTextWithFallback({
        tier: "fast",
        system: `You are RESOLVE — the operating system for open communities. Write 2–3 crisp sentences using ONLY GROUNDED FACTS. Never invent numbers, repos, or funding amounts. Analyst tone — Bloomberg clarity, not marketing. Max 60 words. Focus on the community and capital, not connectors.`,
        prompt: [history, facts, `USER:\n${ctx.question}`].filter(Boolean).join("\n\n"),
        maxOutputTokens: 120,
      }),
      8_000,
      "AI summary",
    );
    return text.trim() || groundedAnswer;
  } catch {
    return groundedAnswer;
  }
}

/** User message → intent → APIs → reasoning → actions. LLM is never step one. */
export async function runMissionOrchestrator(input: {
  question: string;
  messages?: AdvisorMessage[];
  seedEvidence?: import("@/lib/workspace/context").WorkspaceEvidence;
  operatingMode?: import("@/lib/mission/capital-os").OperatingMode;
  fast?: boolean;
  ecosystem?: {
    name: string;
    keywords?: string[];
    repos?: Array<{ owner: string; repo: string; fullName: string }>;
    connectors?: string[];
  };
}): Promise<OrchestratorResult> {
  const started = performance.now();
  const capability = classifyCapability(input.question, input.messages ?? []);
  const phase = detectMissionPhase(input.question, input.messages ?? []);
  const def = getCapabilityDef(capability);

  const collected = await runCollectors({
    capability,
    question: input.question,
    seedEvidence: input.seedEvidence,
    fast: input.fast,
    community: input.ecosystem ?
      {
        name: input.ecosystem.name,
        keywords: input.ecosystem.keywords,
        repos: input.ecosystem.repos,
        connectors: input.ecosystem.connectors,
      }
    : undefined,
  });

  const intent = capabilityToIntent(capability);
  const allFindings = buildIntelligenceFindings(
    collected.evidence,
    input.question,
    intent,
  );
  const findings = filterFindingsForCapability(allFindings, capability);
  const capitalUsd = parseCapitalUsd(input.question);

  const communityName = collected.communityScope ?? input.ecosystem?.name;
  const operatingMode =
    input.operatingMode ?? detectOperatingMode(input.question, collected.community.kind);
  const job = detectMissionJob(input.question, capability, phase, capitalUsd);
  const loopPhase = detectCapitalLoopPhase(job, phase, input.question);

  const ctx: OrchestratorContext = {
    question: input.question,
    capability,
    capabilityLabel: CAPABILITY_LABELS[capability],
    phase,
    community: collected.community,
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
    communityName,
    ecosystemName: communityName,
    researchReferences: collected.researchReferences,
    stepsRun: collected.stepsRun,
    job,
    operatingMode,
    loopPhase,
  };

  const capitalBlueprint =
    job === "design_capital" || /\b(blueprint|policy|distribution plan)\b/i.test(input.question) ?
      buildCapitalBlueprint({ ...ctx, capitalUsd: capitalUsd ?? 100_000 })
    : capitalUsd ? buildCapitalBlueprint({ ...ctx, capitalUsd }) : undefined;

  if (capitalBlueprint) {
    ctx.capitalBlueprint = capitalBlueprint;
  }

  const groundedAnswer = buildGroundedAnswer(ctx);
  const brief = buildIntelligenceBrief(ctx);
  const polished = await maybeEnhanceWithReasoning(
    ctx,
    brief.summary || groundedAnswer,
    input.messages,
    input.fast,
  );
  if (polished && polished !== brief.summary) {
    brief.summary = polished;
  }
  const answer = polished;
  const capabilityActions = def.actions(ctx);
  const contextualActions = contextualMissionActions({
    job,
    mode: operatingMode,
    capability,
    communityKind: collected.community.kind,
    communityName,
    capitalUsd,
    hasBlueprint: Boolean(capitalBlueprint),
    hasOpportunities: collected.opportunities.length > 0,
    loopPhase,
  });
  const setupPills =
    job === "understand" && collected.opportunities.length > 0 ?
      designCapitalSetupPills(communityName)
    : [];
  const quickActions = followUpQuickActions({
    capability,
    communityKind: collected.community.kind,
    communityName,
    capitalUsd,
    hasOpportunities: collected.opportunities.length > 0,
    claimableUsd: collected.evidence.ledger?.claimableUsd,
  });
  const actions = [...capabilityActions, ...contextualActions, ...setupPills, ...quickActions.map((q) => ({
    id: q.id,
    label: q.label,
    prompt: q.prompt,
    kind: "explore" as const,
  }))].filter((a, i, arr) => arr.findIndex((x) => x.id === a.id) === i).slice(0, 6);
  const durationMs = Math.round(performance.now() - started);
  const report = buildMissionReport({
    ctx,
    brief,
    actions,
    objective: input.question,
    durationMs,
    persisted: false,
  });

  return {
    capability,
    capabilityLabel: CAPABILITY_LABELS[capability],
    phase,
    community: collected.community,
    answer: brief.summary || answer,
    headline: brief.headline,
    brief,
    report,
    findings,
    actions,
    stepsRun: collected.stepsRun,
    traces: collected.traces,
    policies: collected.policies,
    opportunities: collected.opportunityCards,
    concentrations: collected.concentrations,
    researchReferences: collected.researchReferences,
    quickActions,
    grounded: true,
    requiresApproval: capability === "execute_settlement" || capability === "allocate_capital",
    durationMs,
  };
}
