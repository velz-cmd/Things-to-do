import type { ProgramPoolState } from "@/lib/capital/pool-checkpoint-types";

const STORAGE_KEY = "resolve.pool.cache.v1";
const MAX_ENTRIES = 80;
const MAX_AGE_MS = 30 * 60_000;

const memory = new Map<string, { pool: ProgramPoolState; at: number }>();

export function poolCacheKey(
  communitySlug: string,
  programId: string | null,
  templateId?: string | null,
): string {
  return `${communitySlug}:${programId ?? ""}:${templateId ?? ""}`;
}

function readStorage(): Record<string, { pool: ProgramPoolState; at: number }> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, { pool: ProgramPoolState; at: number }>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStorage(rows: Record<string, { pool: ProgramPoolState; at: number }>) {
  if (typeof window === "undefined") return;
  const keys = Object.keys(rows).slice(0, MAX_ENTRIES);
  const next: Record<string, { pool: ProgramPoolState; at: number }> = {};
  for (const key of keys) next[key] = rows[key]!;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function isFresh(entry: { at: number } | undefined): boolean {
  if (!entry) return false;
  return Date.now() - entry.at < MAX_AGE_MS;
}

/** Read pool snapshot — memory first, then sessionStorage (stale ok for instant UI). */
export function readPoolCache(key: string): ProgramPoolState | null {
  const mem = memory.get(key);
  if (mem) return mem.pool;

  const stored = readStorage()[key];
  if (!stored?.pool) return null;
  memory.set(key, stored);
  return stored.pool;
}

export function writePoolCache(key: string, pool: ProgramPoolState) {
  const entry = { pool, at: Date.now() };
  memory.set(key, entry);
  const stored = readStorage();
  stored[key] = entry;
  writeStorage(stored);
}

export function poolCacheIsFresh(key: string): boolean {
  const mem = memory.get(key);
  if (mem && isFresh(mem)) return true;
  const stored = readStorage()[key];
  return isFresh(stored);
}
