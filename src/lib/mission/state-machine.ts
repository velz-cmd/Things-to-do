export type MissionStatus =
  | "created"
  | "observing"
  | "reasoning"
  | "awaiting_user"
  | "approved"
  | "executing"
  | "completed"
  | "failed";

const TRANSITIONS: Record<MissionStatus, MissionStatus[]> = {
  created: ["observing", "reasoning", "awaiting_user"],
  observing: ["reasoning", "awaiting_user", "failed"],
  reasoning: ["awaiting_user", "approved", "failed"],
  awaiting_user: ["observing", "reasoning", "approved", "executing", "completed"],
  approved: ["executing", "awaiting_user", "failed"],
  executing: ["completed", "failed", "awaiting_user"],
  completed: ["awaiting_user", "observing"],
  failed: ["observing", "awaiting_user", "created"],
};

export function canTransition(from: MissionStatus, to: MissionStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function statusForCapabilityPhase(
  capability: string,
  phase: string,
  executing = false,
): MissionStatus {
  if (executing) return "executing";
  if (capability === "execute_settlement") {
    return phase === "execute" ? "approved" : "awaiting_user";
  }
  if (phase === "discover") return "observing";
  if (phase === "explain") return "reasoning";
  if (phase === "plan") return "awaiting_user";
  if (phase === "execute") return "approved";
  if (capability === "discover_value_leaks" || capability === "assess_risk") return "observing";
  return "reasoning";
}

export function statusLabel(status: MissionStatus): string {
  switch (status) {
    case "created":
      return "Created";
    case "observing":
      return "Observing";
    case "reasoning":
      return "Reasoning";
    case "awaiting_user":
      return "Awaiting you";
    case "approved":
      return "Approved";
    case "executing":
      return "Executing";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
  }
}
