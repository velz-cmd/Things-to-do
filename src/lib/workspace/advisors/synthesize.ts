import { generateTextWithFallback } from "@/lib/ai/gateway";
import type { WorkspaceEvidence } from "@/lib/workspace/context";
import { evidenceSummary } from "@/lib/workspace/context";
import {
  buildEvidenceActions,
  type EvidenceAction,
} from "@/lib/workspace/advisors/evidence-actions";
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
  evidenceUsed: string[];
  grounded: boolean;
};

function specialistFocus(specialist: AdvisorSpecialist): string {
  switch (specialist) {
    case "treasury":
      return "Focus on treasury balance, obligations, runway, and capital flow at scale.";
    case "settlement":
      return "Focus on claimable balances, batch settlement, Arc, and fulfillment.";
    case "discovery":
      return "Focus on unfunded opportunities, value leaks, and who deserves funding.";
    case "attribution":
      return "Focus on who created value across code, music, research — use participant framing.";
    case "connector":
      return "Focus on sensor health — GitHub, Navidrome, ListenBrainz, OpenAlex.";
    case "community":
      return "Focus on fair allocation policies, percentages, mods, builders — propose splits backed by evidence only.";
    default:
      return "Answer holistically across the open value pipeline.";
  }
}

function buildEvidenceJson(evidence: WorkspaceEvidence): string {
  return JSON.stringify(
    {
      treasury: {
        balanceUsd: evidence.treasury.balanceUsd,
        obligationsUsd: evidence.treasury.obligationsUsd,
        availableUsd: evidence.treasury.availableUsd,
        canSettleGlobally: evidence.treasury.canSettleGlobally,
        message: evidence.treasury.message,
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
      integrationHealth: Object.fromEntries(
        Object.entries(evidence.integrations.live ?? {}).map(([k, v]) => [
          k,
          typeof v === "object" && v && "ok" in v ? (v as { ok: boolean }).ok : v,
        ]),
      ),
    },
    null,
    2,
  );
}

/** Evidence-only advisor — never invent numbers. Falls back to rule-based summary if AI unavailable. */
export async function askValueAdvisor(input: {
  question: string;
  evidence: WorkspaceEvidence;
}): Promise<AdvisorResponse> {
  const specialist = routeAdvisorSpecialist(input.question);
  const actions = buildEvidenceActions(input.evidence);
  const evidenceUsed = [evidenceSummary(input.evidence)];

  const system = `You are the ${SPECIALIST_LABELS[specialist]} for RESOLVE — infrastructure that discovers, authorizes, routes, and settles value across open ecosystems.

RULES (strict):
- Use ONLY numbers and facts from the EVIDENCE JSON below.
- If data is missing, say what is missing — never guess.
- Propose concrete next steps referencing the recommended actions when relevant.
- Frame people as "value participants" (maintainers, artists, researchers, moderators).
- ${specialistFocus(specialist)}
- Keep answers under 200 words. Be direct like Cursor or Linear AI.`;

  const prompt = `USER QUESTION:\n${input.question}\n\nEVIDENCE JSON:\n${buildEvidenceJson(input.evidence)}\n\nRECOMMENDED ACTIONS:\n${actions.map((a) => `- ${a.label}: ${a.detail}`).join("\n")}`;

  try {
    const { text } = await generateTextWithFallback({
      tier: "quality",
      system,
      prompt,
    });

    return {
      specialist,
      specialistLabel: SPECIALIST_LABELS[specialist],
      answer: text.trim(),
      actions,
      evidenceUsed,
      grounded: true,
    };
  } catch {
    const fallback = [
      evidenceSummary(input.evidence),
      "",
      "Recommended next steps:",
      ...actions.map((a) => `• ${a.label} — ${a.detail}`),
    ].join("\n");

    return {
      specialist,
      specialistLabel: SPECIALIST_LABELS[specialist],
      answer: fallback,
      actions,
      evidenceUsed,
      grounded: true,
    };
  }
}

/** Quick "What should I do next?" without a custom question. */
export async function getNextSteps(evidence: WorkspaceEvidence): Promise<AdvisorResponse> {
  return askValueAdvisor({
    question: "What should I do next? Give me 3–5 concrete, evidence-backed actions.",
    evidence,
  });
}
