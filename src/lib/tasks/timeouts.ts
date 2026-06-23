import type { TaskStatus } from "@/lib/deputy/types";

export const STATE_TIMEOUTS: Partial<Record<TaskStatus, number>> = {
  evidence_gathering: 60,
  planning: 30,
  executing: 120,
  waiting_for_response: 300,
  retrying: 120,
  escalated: 180,
  proof_pending: 120,
};

export interface TimeoutFallback {
  status: "needs_attention";
  reason: string;
  nextAction: string;
}

export function timeoutFallbackForStatus(status: TaskStatus): TimeoutFallback {
  switch (status) {
    case "evidence_gathering":
      return {
        status: "needs_attention",
        reason: "Evidence search is taking longer than expected",
        nextAction: "Connect Gmail or upload a receipt manually",
      };
    case "planning":
      return {
        status: "needs_attention",
        reason: "Planning step timed out",
        nextAction: "Review task details and retry",
      };
    case "executing":
      return {
        status: "needs_attention",
        reason: "Browser submission did not complete in time",
        nextAction: "Retry browser step or approve manual submission",
      };
    case "waiting_for_response":
      return {
        status: "needs_attention",
        reason: "Waiting for company response",
        nextAction: "Next follow-up scheduled in 24 hours. You can approve human escalation.",
      };
    case "retrying":
      return {
        status: "needs_attention",
        reason: "Follow-up attempts need review",
        nextAction: "Approve next follow-up or escalate to human operator",
      };
    case "escalated":
      return {
        status: "needs_attention",
        reason: "Escalation requires your approval",
        nextAction: "Approve human escalation or cancel mission",
      };
    case "proof_pending":
      return {
        status: "needs_attention",
        reason: "Proof verification is pending",
        nextAction: "Upload proof or wait for merchant confirmation",
      };
    default:
      return {
        status: "needs_attention",
        reason: "This step needs your attention",
        nextAction: "Review mission and choose next action",
      };
  }
}

export function computeTimeoutAt(
  status: TaskStatus,
  startedAt: Date = new Date()
): Date | null {
  const seconds = STATE_TIMEOUTS[status];
  if (!seconds) return null;
  return new Date(startedAt.getTime() + seconds * 1000);
}

export function isStatusTimedOut(
  status: string,
  statusTimeoutAt: Date | string | null | undefined
): boolean {
  if (!statusTimeoutAt) return false;
  const terminal = ["settled", "failed", "refunded", "cancelled", "verified", "needs_attention"];
  if (terminal.includes(status)) return false;
  return new Date(statusTimeoutAt).getTime() <= Date.now();
}
