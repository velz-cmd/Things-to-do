import { generateTextWithFallback } from "@/lib/ai/gateway";
import type { WorkspaceEvidence } from "@/lib/workspace/context";
import {
  buildEvidenceActions,
  type EvidenceAction,
} from "@/lib/workspace/advisors/evidence-actions";
import {
  buildValueConcentrations,
  type ValueConcentration,
} from "@/lib/workspace/advisors/concentrations";
import {
  buildPolicyProposals,
  type PolicyProposal,
} from "@/lib/workspace/advisors/policy-proposals";
import {
  opportunitiesToCards,
  type OpportunityCard,
} from "@/lib/workspace/advisors/opportunity-cards";
import {
  buildIntelligenceFindings,
  buildIntelligenceHeadline,
  type MissionFinding,
} from "@/lib/workspace/advisors/intelligence-findings";
import { detectMissionPhase, type MissionPhase } from "@/lib/mission/phases";
import { detectMissionIntent } from "@/lib/mission/intents";
import {
  routeAdvisorSpecialist,
  type AdvisorSpecialist,
} from "@/lib/workspace/advisors/router";

export type AdvisorResponse = {
  specialist: AdvisorSpecialist;
  specialistLabel: string;
  answer: string;
  headline: string;
  findings: MissionFinding[];
  phase: MissionPhase;
  actions: EvidenceAction[];
  concentrations: ValueConcentration[];
  policies: PolicyProposal[];
  opportunities: OpportunityCard[];
  evidenceUsed: string[];
  grounded: boolean;
  requiresApproval: boolean;
};

function buildEvidenceJson(evidence: WorkspaceEvidence): string {
  return JSON.stringify(
    {
      treasury: {
        balanceUsd: evidence.treasury.balanceUsd,
        obligationsUsd: evidence.treasury.obligationsUsd,
        availableUsd: evidence.treasury.availableUsd,
        canSettleGlobally: evidence.treasury.canSettleGlobally,
      },
      ledger: evidence.ledger
        ? {
            count: evidence.ledger.count,
            authorizedUsd: evidence.ledger.authorizedUsd,
            pendingFundingUsd: evidence.ledger.pendingFundingUsd,
            claimableUsd: evidence.ledger.claimableUsd,
            settledUsd: evidence.ledger.settledUsd,
          }
        : null,
      capitalFlow: evidence.capitalFlow,
      connectors: evidence.connectors.map((c) => ({
        id: c.id,
        health: c.health,
        eventsToday: c.eventsToday,
        authorizationCount: c.authorizationCount,
      })),
      opportunities: evidence.opportunities.map((o) => ({
        repo: o.fullName,
        priority: o.priority,
        stars: o.stars,
        fundingGapUsd: o.health.fundingGapUsd,
        headline: o.headline,
      })),
    },
    null,
    2,
  );
}


export type AdvisorMessage = {
  role: "user" | "assistant";
  content: string;
};

function buildExplainFallback(finding: MissionFinding | undefined, question: string): string {
  if (!finding) {
    return "Pick a discovery card and ask Why? — I'll explain the evidence behind it.";
  }
  const parts = [finding.insight];
  if (finding.impact) parts.push(finding.impact);
  if (finding.bullets?.length) {
    parts.push("", "Evidence:", ...finding.bullets.map((b) => `• ${b}`));
  }
  parts.push("", `Confidence: ${finding.confidence}%`);
  if (/why/i.test(question)) return parts.join("\n");
  return parts.join("\n");
}

/** Protocol analyst — intelligence first, essays never. */
export async function askValueAdvisor(input: {
  question: string;
  evidence: WorkspaceEvidence;
  messages?: AdvisorMessage[];
}): Promise<AdvisorResponse> {
  const specialist = routeAdvisorSpecialist(input.question);
  const intent = detectMissionIntent(input.question);
  const phase = detectMissionPhase(input.question, input.messages ?? []);
  const actions = buildEvidenceActions(input.evidence);
  const concentrations = buildValueConcentrations(input.evidence);
  const policies = buildPolicyProposals(input.evidence);
  const opportunities = opportunitiesToCards(input.evidence.opportunities);
  const findings = buildIntelligenceFindings(input.evidence, input.question, intent);
  const headline = buildIntelligenceHeadline(findings);
  const evidenceUsed = findings.map((f) => f.insight);

  const base = {
    specialist,
    specialistLabel: "Intelligence",
    headline,
    findings,
    phase,
    actions,
    concentrations,
    policies,
    opportunities,
    evidenceUsed,
    grounded: true,
    requiresApproval: true,
  };

  if (phase === "discover" && findings.length > 0) {
    return { ...base, answer: headline };
  }

  const system = `You are RESOLVE — an economic strategist for the open internet.

You reason like a world-class analyst: connect ideas, compare ecosystems, identify tradeoffs, estimate consequences, propose alternatives.

FORBIDDEN:
- Numbered lists of obvious observations
- Restating raw database fields or ledger values
- "Treasury balance is", "GitHub connector", "Navidrome", "Authorization Ledger", "Sensor"
- Duplicating discovery card content verbatim when FINDINGS are provided
- Approve, Execute, Reject buttons or settlement language unless user asked to move money

REQUIRED:
- Lead with the insight that matters most
- Explain causality and economic consequences
- Compare to peer ecosystems when relevant
- Max 120 words
- If FINDINGS exist, add reasoning they do not already state — never repeat their bullets`;

  const topFinding = findings[0];
  const findingContext =
    findings.length > 0 ?
      `FINDINGS (do not repeat verbatim — add reasoning):\n${findings
        .slice(0, 3)
        .map((f) => `- ${f.title}: ${f.insight}`)
        .join("\n")}`
    : topFinding ?
      `FINDING:\n${topFinding.title}\n${topFinding.insight}`
    : "";

  const history =
    input.messages?.length ?
      input.messages
        .map((m) => `${m.role === "user" ? "USER" : "ASSISTANT"}:\n${m.content}`)
        .join("\n\n")
    : "";

  const prompt = [
    history ? `CONVERSATION:\n${history}\n` : "",
    findingContext,
    `USER:\n${input.question}`,
    `\nEVIDENCE:\n${buildEvidenceJson(input.evidence)}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const { text } = await generateTextWithFallback({
      tier: phase === "explain" ? "quality" : "fast",
      system,
      prompt,
    });

    return { ...base, answer: text.trim() };
  } catch {
    const fallback =
      phase === "explain" ? buildExplainFallback(topFinding, input.question) : headline;
    return { ...base, answer: fallback || buildIntelligenceHeadline(findings) };
  }
}

export function getProtocolWelcome(evidence?: {
  concentrations: { title: string; detail: string }[];
  treasuryBalanceUsd: number;
  ledgerCount: number;
}) {
  const hasLive = evidence && (evidence.ledgerCount > 0 || evidence.concentrations.length > 1);

  return {
    specialistLabel: "Economic intelligence",
    greeting: "What would you like RESOLVE to do?",
    subtitle: hasLive
      ? "Ask about any open community — value, risk, funding, claims, or dependencies."
      : "The open internet is one economy. RESOLVE understands how value flows across it.",
    requiresApproval: true,
    naturalLanguageActions: [
      "I have $100k — who deserves it?",
      "Where is our ecosystem breaking?",
      "Am I getting paid fairly?",
      "Who depends on me?",
      "Find value leaks",
      "Where should grants go?",
      "Who reused my work?",
      "Which libraries are at risk?",
    ],
    discoverPrompts: [
      "Who deserves funding?",
      "Ecosystem risk scan",
      "Unclaimed earnings",
      "Critical dependencies",
      "Allocate treasury",
      "Show value concentrations",
    ],
  };
}
