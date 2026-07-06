import type { MissionSession } from "@/lib/mission/toolbox/mission-library";

/** Chats with no user message are drafts — hide from history. */
export function missionSessionHasUserMessage(session: MissionSession): boolean {
  if (session.turns?.some((t) => t.role === "user" && t.text.trim())) return true;
  if (session.userTurnCount != null) return session.userTurnCount > 0;
  return false;
}

export function isMeaningfulMissionSession(session: MissionSession): boolean {
  if (!missionSessionHasUserMessage(session)) return false;
  const title = session.title?.trim() ?? "";
  if (title === "New mission" && !(session.scope?.trim() || session.query?.trim())) {
    return false;
  }
  return true;
}

export function filterMeaningfulMissionSessions(sessions: MissionSession[]): MissionSession[] {
  return sessions.filter(isMeaningfulMissionSession);
}
