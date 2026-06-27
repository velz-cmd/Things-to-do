import { generateTextWithFallback } from "@/lib/ai/gateway";
import type { WorkspaceEvidence } from "@/lib/workspace/context";
import { evidenceSummary } from "@/lib/workspace/context";
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
  routeAdvisorSpecialist,
  SPECIALIST_LABELS,
  type AdvisorSpecialist,
} from "@/lib/workspace/advisors/router";

export type AdvisorResponse = {
  specialist: AdvisorSpecialist;
  specialistLabel: string;
  answer: string;
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

function buildProtocolFallback(
  evidence: WorkspaceEvidence,
  actions: EvidenceAction[],
  concentrations: ValueConcentration[],
): string {
  const lines = [
    "I analyzed your connected ecosystems using live protocol data.",
    "",
  ];

  if (concentrations.length) {
    lines.push("Value concentrations:");
    concentrations.forEach((c, i) => {
      lines.push(`${i + 1}. ${c.title} — ${c.detail}`);
    });
    lines.push("");
  }

  lines.push(evidenceSummary(evidence));
  lines.push("");
  lines.push("Nothing executes until you approve. You can modify any allocation or use manual controls.");

  if (actions.length) {
    lines.push("");
    lines.push("Suggested actions:");
    actions.forEach((a) => lines.push(`• ${a.label}`));
  }

  return lines.join("\n");
}

/** Protocol analyst — open chat for any community, evidence-only. */
export async function askValueAdvisor(input: {
  question: string;
  evidence: WorkspaceEvidence;
}): Promise<AdvisorResponse> {
  const specialist = routeAdvisorSpecialist(input.question);
  const actions = buildEvidenceActions(input.evidence);
  const concentrations = buildValueConcentrations(input.evidence);
  const policies = buildPolicyProposals(input.evidence);
  const opportunities = opportunitiesToCards(input.evidence.opportunities);
  const evidenceUsed = [evidenceSummary(input.evidence)];

  const system = `You are RESOLVE Protocol — an intelligent analyst for open ecosystems. Not a company support bot. Not treasury software.

You serve maintainers, musicians, researchers, designers, moderators, founders, DAOs, and foundations equally.

STRICT RULES:
- Use ONLY facts from EVIDENCE JSON. Never invent participant counts, dollar amounts, or percentages.
- If data is missing, say what to connect — never guess.
- Reason about value concentrations (numbered list) when distributing or analyzing.
- Propose policy splits as suggestions — state clearly: "Nothing executes until you approve."
- Never use dropdown wizards or forced category checkboxes in your tone.
- Speak like a protocol analyst: direct, evidence-backed, respectful of user agency.
- Under 250 words unless listing concentrations.`;

  const prompt = `USER:\n${input.question}\n\nEVIDENCE:\n${buildEvidenceJson(input.evidence)}\n\nCONCENTRATIONS:\n${concentrations.map((c, i) => `${i + 1}. ${c.title}: ${c.detail}`).join("\n")}`;

  try {
    const { text } = await generateTextWithFallback({
      tier: "quality",
      system,
      prompt,
    });

    return {
      specialist,
      specialistLabel: "Protocol",
      answer: text.trim(),
      actions,
      concentrations,
      policies,
      opportunities,
      evidenceUsed,
      grounded: true,
      requiresApproval: true,
    };
  } catch {
    return {
      specialist,
      specialistLabel: "Protocol",
      answer: buildProtocolFallback(input.evidence, actions, concentrations),
      actions,
      concentrations,
      policies,
      opportunities,
      evidenceUsed,
      grounded: true,
      requiresApproval: true,
    };
  }
}

export function getProtocolWelcome(evidence?: {
  concentrations: { title: string; detail: string }[];
  treasuryBalanceUsd: number;
  ledgerCount: number;
}) {
  const hasLive = evidence && (evidence.ledgerCount > 0 || evidence.concentrations.length > 1);

  return {
    specialistLabel: "Protocol",
    greeting: hasLive
      ? "Open ecosystems are active. Here's what the network sees."
      : "Sensors are standing by across open ecosystems.",
    subtitle: hasLive
      ? evidence!.concentrations[0]
        ? `${evidence!.concentrations[0].title} — ${evidence!.concentrations[0].detail}`
        : "Ask where value is leaking, who is underfunded, or how to allocate capital."
      : "Value is discovered where people already work — code, music, research, communities. Connect sensors; capital follows.",
    requiresApproval: true,
    naturalLanguageActions: [
      "Find value leaks",
      "Show underfunded maintainers",
      "Where should $100k go?",
      "Who powers our ecosystem?",
      "Show communities at risk",
      "Find funding opportunities",
      "Who is underpaid?",
      "Recommend allocation",
    ],
    discoverPrompts: [
      "Find value leaks",
      "Underfunded libraries",
      "Allocate treasury",
      "Show opportunities",
      "Who deserves recognition?",
      "Ecosystem risk scan",
    ],
  };
}
