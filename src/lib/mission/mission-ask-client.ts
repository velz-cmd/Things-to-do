import type { MissionPhase } from "@/lib/mission/phases";
import type { MissionFinding } from "@/lib/workspace/advisors/intelligence-findings";
import type { IntelligenceBrief } from "@/lib/mission/intelligence-brief";
import type { MissionReport } from "@/lib/mission/mission-report";
import type { PolicyProposal } from "@/lib/workspace/advisors/policy-proposals";
import type { OpportunityCard } from "@/lib/workspace/advisors/opportunity-cards";
import type { CapabilityAction } from "@/lib/mission/capabilities/types";

export type MissionAskPayload = {
  ok?: boolean;
  answer: string;
  headline: string;
  brief?: IntelligenceBrief;
  report?: MissionReport;
  findings?: MissionFinding[];
  phase?: MissionPhase;
  capability?: string;
  actions?: CapabilityAction[];
  opportunities?: OpportunityCard[];
  policies?: PolicyProposal[];
  stepsRun?: string[];
  status?: string;
  error?: string;
};

const MISSION_ASK_TIMEOUT_MS = 45_000;

/** Fast Mission chat — treasury/ledger grounded, skips OSS scan + web research by default. */
export async function askMissionWorkspace(
  input: {
    question: string;
    messages?: Array<{ role: "user" | "assistant"; content: string }>;
    ecosystem?: {
      name: string;
      keywords?: string[];
      repos?: Array<{ owner: string; repo: string; fullName: string }>;
      connectors?: string[];
    };
    operatingMode?: import("@/lib/mission/capital-os").OperatingMode;
    fast?: boolean;
  },
  signal?: AbortSignal,
): Promise<MissionAskPayload> {
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), MISSION_ASK_TIMEOUT_MS);
  const onExternalAbort = () => timeoutController.abort();
  signal?.addEventListener("abort", onExternalAbort);

  try {
    const res = await fetch("/api/workspace/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: timeoutController.signal,
      body: JSON.stringify({
        question: input.question,
        messages: input.messages,
        ecosystem: input.ecosystem,
        operatingMode: input.operatingMode,
        fast: input.fast ?? true,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as MissionAskPayload & { error?: string };
    if (!res.ok) {
      throw new Error(json.error ?? `Mission ask failed (${res.status})`);
    }
    return json;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onExternalAbort);
  }
}

export { MISSION_ASK_TIMEOUT_MS };
