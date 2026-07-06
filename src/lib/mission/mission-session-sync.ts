import type { MissionTurn } from "@/components/resolve/mission-control/mission-workspace";
import type { SyncMissionTurnInput } from "@/lib/mission/server/missions";

export function missionTurnsToSyncInput(turns: MissionTurn[]): SyncMissionTurnInput[] {
  return turns.map((t) => ({
    role: t.role,
    text: t.text,
    phase: t.phase,
    capability: t.capability,
    findings: t.findings,
    actions: t.nextSteps,
    report: t.report,
    payload: {
      blueprint: t.blueprint,
      agentSignal: t.agentSignal,
      fulfillPool: t.fulfillPool ?? t.communalPool,
      personalPool: t.personalPool ?? t.batchAllocation,
    },
  }));
}

export function sessionTitleFromTurns(turns: MissionTurn[], fallback = "New mission"): string {
  const firstUser = turns.find((t) => t.role === "user");
  const raw = firstUser?.text?.trim() || fallback;
  return raw.length > 72 ? `${raw.slice(0, 69)}…` : raw;
}
