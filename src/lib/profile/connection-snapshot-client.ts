"use client";

import type { UserConnectionState } from "@/lib/profile/connection-state-types";

const STORAGE_KEY = "resolve:connection-snapshot:v2";

type SnapshotRow = {
  userId: string;
  state: UserConnectionState;
  savedAt: string;
};

function readAll(): SnapshotRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SnapshotRow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(rows: SnapshotRow[]) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(rows.slice(0, 4)));
  } catch {
    /* private mode */
  }
}

/** Instant hydration for Profile / Discover / Communities while network catches up. */
export function readConnectionSnapshot(userId: string): UserConnectionState | null {
  const row = readAll().find((r) => r.userId === userId);
  if (!row) return null;
  const ageMs = Date.now() - new Date(row.savedAt).getTime();
  if (ageMs > 30 * 60_000) return null;
  return row.state;
}

export function writeConnectionSnapshot(userId: string, state: UserConnectionState) {
  if (!state.signedIn) return;
  const rows = readAll().filter((r) => r.userId !== userId);
  rows.unshift({ userId, state, savedAt: new Date().toISOString() });
  writeAll(rows);
}

export function patchConnectionSnapshot(
  userId: string,
  patch: Partial<UserConnectionState>,
): UserConnectionState | null {
  const current = readConnectionSnapshot(userId);
  if (!current) return null;
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  writeConnectionSnapshot(userId, next);
  return next;
}
