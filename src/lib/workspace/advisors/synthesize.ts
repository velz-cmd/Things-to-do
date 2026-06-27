import type { WorkspaceEvidence } from "@/lib/workspace/context";
import type { EvidenceAction } from "@/lib/workspace/advisors/evidence-actions";
import type { ValueConcentration } from "@/lib/workspace/advisors/concentrations";
import type { PolicyProposal } from "@/lib/workspace/advisors/policy-proposals";
import type { OpportunityCard } from "@/lib/workspace/advisors/opportunity-cards";
import type { MissionFinding } from "@/lib/workspace/advisors/intelligence-findings";
import type { MissionPhase } from "@/lib/mission/phases";
import { runMissionOrchestrator } from "@/lib/mission/orchestrator";
import type { CapabilityAction, CapabilityId } from "@/lib/mission/capabilities/types";
import type { IntelligenceBrief } from "@/lib/mission/intelligence-brief";
import type { MissionReport } from "@/lib/mission/mission-report";

export type AdvisorResponse = {
  capability: CapabilityId;
  capabilityLabel: string;
  specialist: "intelligence";
  specialistLabel: string;
  answer: string;
  headline: string;
  brief: IntelligenceBrief;
  report: MissionReport;
  findings: MissionFinding[];
  phase: MissionPhase;
  actions: CapabilityAction[];
  evidenceActions: EvidenceAction[];
  concentrations: ValueConcentration[];
  policies: PolicyProposal[];
  opportunities: OpportunityCard[];
  evidenceUsed: string[];
  stepsRun: string[];
  grounded: boolean;
  requiresApproval: boolean;
};

export type AdvisorMessage = {
  role: "user" | "assistant";
  content: string;
};

/** Mission pipeline — APIs and capabilities first, LLM explains grounded evidence only. */
export async function askValueAdvisor(input: {
  question: string;
  evidence?: WorkspaceEvidence;
  messages?: AdvisorMessage[];
  ecosystem?: {
    name: string;
    keywords?: string[];
    repos?: Array<{ owner: string; repo: string; fullName: string }>;
    connectors?: string[];
  };
}): Promise<AdvisorResponse> {
  const result = await runMissionOrchestrator({
    question: input.question,
    messages: input.messages,
    ecosystem: input.ecosystem,
  });

  return {
    capability: result.capability,
    capabilityLabel: result.capabilityLabel,
    specialist: "intelligence",
    specialistLabel: result.capabilityLabel,
    answer: result.answer,
    headline: result.headline,
    brief: result.brief,
    report: result.report,
    findings: result.findings,
    phase: result.phase,
    actions: result.actions,
    evidenceActions: [],
    concentrations: result.concentrations,
    policies: result.policies,
    opportunities: result.opportunities,
    evidenceUsed: result.traces.map((t) => `${t.source}: ${t.summary}`),
    stepsRun: result.stepsRun,
    grounded: result.grounded,
    requiresApproval: result.requiresApproval,
  };
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
      "Find value leaks in React",
      "Compare React and Vue",
      "Show me underfunded AI infrastructure communities",
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
