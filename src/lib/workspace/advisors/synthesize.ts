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

export type AdvisorMessage = {
  role: "user" | "assistant";
  content: string;
};

/** Protocol analyst — open chat for any community, evidence-only. */
export async function askValueAdvisor(input: {
  question: string;
  evidence: WorkspaceEvidence;
  messages?: AdvisorMessage[];
}): Promise<AdvisorResponse> {
  const specialist = routeAdvisorSpecialist(input.question);
  const actions = buildEvidenceActions(input.evidence);
  const concentrations = buildValueConcentrations(input.evidence);
  const policies = buildPolicyProposals(input.evidence);
  const opportunities = opportunitiesToCards(input.evidence.opportunities);
  const evidenceUsed = [evidenceSummary(input.evidence)];

  const system = `You are RESOLVE — economic intelligence for the open internet. Not a payments app. Not a GitHub tool. Not treasury software.

You make capital allocation effortless: founders, DAOs, maintainers, artists, researchers, foundations, and protocols all ask the same engine different questions.

CAPABILITY ORDER (reflect this in tone):
1. Observe — what sensors see across open communities
2. Understand — explain relationships, value, risk, dependencies
3. Recommend — evidence-backed proposals (allocations, budgets, claims)
4. Execute — only when user approves; never imply money moved without approval

STRICT RULES:
- Use ONLY facts from EVIDENCE JSON. Never invent counts, dollars, or percentages.
- If data is missing, say what to connect — never guess.
- Answer the user's actual question first (risk, claims, dependencies, funding, fairness — not always funding).
- Reason about value concentrations when relevant.
- Speak like a protocol analyst: direct, evidence-backed, respectful of user agency.
- Under 250 words unless listing concentrations or allocations.`;

  const history =
    input.messages?.length ?
      input.messages
        .map((m) => `${m.role === "user" ? "USER" : "ASSISTANT"}:\n${m.content}`)
        .join("\n\n")
    : "";

  const prompt = [
    history ? `CONVERSATION:\n${history}\n` : "",
    `USER:\n${input.question}`,
    `\nEVIDENCE:\n${buildEvidenceJson(input.evidence)}`,
    `\nCONCENTRATIONS:\n${concentrations.map((c, i) => `${i + 1}. ${c.title}: ${c.detail}`).join("\n")}`,
  ].join("\n");

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
