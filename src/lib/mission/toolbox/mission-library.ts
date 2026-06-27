import type { MissionLibraryEntry } from "@/lib/mission/toolbox/types";

const STORAGE_KEY = "resolve-mission-library";
const MAX_ENTRIES = 24;

export function loadMissionLibrary(): MissionLibraryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MissionLibraryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveMissionLibraryEntry(entry: Omit<MissionLibraryEntry, "id" | "savedAt">) {
  if (typeof window === "undefined") return;
  const existing = loadMissionLibrary();
  const next: MissionLibraryEntry = {
    ...entry,
    id: `ml-${Date.now()}`,
    savedAt: new Date().toISOString(),
  };
  const deduped = [next, ...existing.filter((e) => e.query !== entry.query)].slice(0, MAX_ENTRIES);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(deduped));
}

export function removeMissionLibraryEntry(id: string) {
  if (typeof window === "undefined") return;
  const next = loadMissionLibrary().filter((e) => e.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
