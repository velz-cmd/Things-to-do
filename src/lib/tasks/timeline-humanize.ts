import type { TaskEvent } from "@/lib/deputy/ui-types";

const PHASE_LABELS: Record<string, string> = {
  created: "Task assigned",
  authorized: "Budget authorized",
  evidence_gathering: "Evidence search completed",
  planning: "Claim strategy prepared",
  executing: "Claim request sent",
  waiting_for_response: "Waiting for company response",
  retrying: "Follow-up scheduled",
  escalated: "Escalation in progress",
  needs_attention: "Needs your attention",
  proof_pending: "Verifying proof",
  verified: "Proof verified",
  settled: "Settlement released",
  failed: "Mission failed",
  cancelled: "Mission cancelled",
  tool: "Tool action completed",
  browser: "Browser action completed",
  handoff: "Human review requested",
};

function humanizeMessage(event: TaskEvent): string {
  const msg = event.message;
  if (msg.startsWith("AI plan:")) return "Execution plan prepared";
  if (msg.includes("Gmail:")) return "Booking or receipt found";
  if (msg.includes("Confirmation captured")) return "Cancellation confirmation captured";
  if (msg.includes("Portal claim submitted")) return "Claim submitted to portal";
  if (msg.includes("Outbound claim email")) return "Follow-up email sent";
  if (msg.includes("Proof VERIFIED")) return "Proof verified";
  if (msg.includes("Arc settlement")) return "Arc settlement released";
  if (msg.includes("Invalid transition")) return "Manual review needed";
  if (msg.includes("Scheduled follow-up")) return "Follow-up scheduled";
  if (msg.includes("timeout") || msg.includes("timed out")) return event.message;
  return PHASE_LABELS[event.phase] ?? msg.replace(/Planner:|Evidence:|Executor:/g, "").trim();
}

export interface HumanTimelineItem {
  id: string;
  label: string;
  state: "now" | "done" | "next" | "blocked";
  timestamp?: string;
  isTechnical?: boolean;
}

export function buildHumanTimeline(
  events: TaskEvent[],
  status: string,
  limit = 5
): HumanTimelineItem[] {
  const sorted = [...events].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const items: HumanTimelineItem[] = [];
  const seen = new Set<string>();

  for (const ev of sorted) {
    const label = humanizeMessage(ev);
    if (seen.has(label)) continue;
    seen.add(label);
    items.push({
      id: ev.id,
      label,
      state: "done",
      timestamp: ev.createdAt,
    });
    if (items.length >= limit - 1) break;
  }

  const nowLabel =
    status === "needs_attention"
      ? "Needs your attention"
      : PHASE_LABELS[status] ?? status.replace(/_/g, " ");

  const nextMap: Record<string, string> = {
    created: "Lock task budget",
    authorized: "Start evidence search",
    evidence_gathering: "Verify policy eligibility",
    planning: "Submit claim",
    executing: "Wait for response",
    waiting_for_response: "Verify refund approval",
    retrying: "Check follow-up result",
    proof_pending: "Verify proof",
    verified: "Release settlement",
    needs_attention: "Review and approve next step",
  };

  return [
    { id: "now", label: nowLabel, state: "now" as const },
    ...items.map((i) => ({ ...i, state: "done" as const })),
    {
      id: "next",
      label: nextMap[status] ?? "Awaiting next step",
      state: "next" as const,
    },
  ].slice(0, limit + 1);
}

export function isTechnicalEvent(event: TaskEvent): boolean {
  return (
    event.phase === "tool" ||
    event.message.includes("AI plan:") ||
    event.message.includes("Invalid transition") ||
    /^[A-Z][a-z]+:[a-z_]+$/.test(event.phase)
  );
}
