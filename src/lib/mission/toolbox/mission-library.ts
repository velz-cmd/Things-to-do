export type MissionSession = {
  id: string;
  title: string;
  kind: "mission" | "agent";
  query: string;
  savedAt: string;
  updatedAt: string;
  findingCount?: number;
  turns?: Array<{ id: string; role: "user" | "resolve"; text: string }>;
};

const STORAGE_KEY = "resolve-mission-sessions";
const MAX_SESSIONS = 32;

export function loadMissionSessions(): MissionSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return migrateLegacyLibrary();
    const parsed = JSON.parse(raw) as MissionSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function migrateLegacyLibrary(): MissionSession[] {
  try {
    const legacy = localStorage.getItem("resolve-mission-library");
    if (!legacy) return [];
    const entries = JSON.parse(legacy) as { id: string; title: string; query: string; savedAt: string; findingCount?: number }[];
    if (!Array.isArray(entries)) return [];
    const sessions: MissionSession[] = entries.map((e) => ({
      id: e.id,
      title: e.title,
      kind: "mission" as const,
      query: e.query,
      savedAt: e.savedAt,
      updatedAt: e.savedAt,
      findingCount: e.findingCount,
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    return sessions;
  } catch {
    return [];
  }
}

export function createMissionSession(kind: "mission" | "agent"): MissionSession {
  const now = new Date().toISOString();
  return {
    id: `ms-${Date.now()}`,
    title: kind === "agent" ? "New agent run" : "New mission",
    kind,
    query: "",
    savedAt: now,
    updatedAt: now,
    turns: [],
  };
}

export function upsertMissionSession(session: MissionSession) {
  if (typeof window === "undefined") return;
  const existing = loadMissionSessions();
  const idx = existing.findIndex((s) => s.id === session.id);
  const next = { ...session, updatedAt: new Date().toISOString() };
  if (idx >= 0) {
    existing[idx] = next;
  } else {
    existing.unshift(next);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing.slice(0, MAX_SESSIONS)));
}

export function removeMissionSession(id: string) {
  if (typeof window === "undefined") return;
  const next = loadMissionSessions().filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function getMissionSession(id: string): MissionSession | undefined {
  return loadMissionSessions().find((s) => s.id === id);
}

/** @deprecated use MissionSession */
export function loadMissionLibrary() {
  return loadMissionSessions();
}

export function saveMissionLibraryEntry(entry: { title: string; query: string; findingCount?: number }) {
  const sessions = loadMissionSessions();
  const existing = sessions.find((s) => s.query === entry.query);
  if (existing) {
    upsertMissionSession({
      ...existing,
      title: entry.title,
      findingCount: entry.findingCount,
      updatedAt: new Date().toISOString(),
    });
    return existing.id;
  }
  const session: MissionSession = {
    id: `ms-${Date.now()}`,
    title: entry.title,
    kind: "mission",
    query: entry.query,
    savedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    findingCount: entry.findingCount,
  };
  upsertMissionSession(session);
  return session.id;
}

export function removeMissionLibraryEntry(id: string) {
  removeMissionSession(id);
}

export function formatSessionTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
