const STORAGE_KEY = "resolve-mission-chat-tombstones";
const MAX_TOMBSTONES = 200;

function storageAvailable(): boolean {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
}

function readSet(): Set<string> {
  if (!storageAvailable()) return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function writeSet(ids: Set<string>) {
  if (!storageAvailable()) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids].slice(0, MAX_TOMBSTONES)));
}

export function getMissionChatTombstones(): Set<string> {
  return readSet();
}

export function isMissionChatTombstoned(id: string): boolean {
  return readSet().has(id);
}

export function addMissionChatTombstone(id: string) {
  if (!id) return;
  const next = readSet();
  next.add(id);
  writeSet(next);
}

export function removeMissionChatTombstone(id: string) {
  const next = readSet();
  next.delete(id);
  writeSet(next);
}

export function filterOutTombstonedSessions<T extends { id: string }>(sessions: T[]): T[] {
  const tombstones = readSet();
  if (tombstones.size === 0) return sessions;
  return sessions.filter((s) => !tombstones.has(s.id));
}
