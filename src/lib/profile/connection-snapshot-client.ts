"use client";

import type { UserConnectionState } from "@/lib/profile/connection-state-types";

const STORAGE_KEY = "resolve:connection-snapshot:v3";
export const CONNECTION_SNAPSHOT_EVENT = "resolve:connection-snapshot";

type SnapshotRow = {
  userId: string;
  state: UserConnectionState;
  savedAt: string;
};

function readAll(): SnapshotRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows.slice(0, 4)));
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
  const current = readConnectionSnapshot(userId);
  const merged = current ? mergeConnectionStates(current, state) : state;
  const rows = readAll().filter((r) => r.userId !== userId);
  rows.unshift({ userId, state: merged, savedAt: new Date().toISOString() });
  writeAll(rows);
  window.dispatchEvent(new CustomEvent(CONNECTION_SNAPSHOT_EVENT, { detail: { userId } }));
}

/** Newer persisted state wins. Equal/older responses cannot erase a confirmed connection. */
export function mergeConnectionStates(
  current: UserConnectionState,
  incoming: UserConnectionState,
): UserConnectionState {
  const currentTime = Date.parse(current.updatedAt) || 0;
  const incomingTime = Date.parse(incoming.updatedAt) || 0;
  if (incomingTime > currentTime) return incoming;

  const currentPlatforms = new Map(current.platforms.map((row) => [row.id, row]));
  const platforms = incoming.platforms.map((row) => {
    const confirmed = currentPlatforms.get(row.id);
    return confirmed?.connected && !row.connected ? confirmed : row;
  });
  for (const row of current.platforms) {
    if (!platforms.some((candidate) => candidate.id === row.id)) platforms.push(row);
  }
  return {
    ...incoming,
    updatedAt: current.updatedAt,
    lastSyncedAt: current.lastSyncedAt ?? incoming.lastSyncedAt,
    platforms,
    installedCommunitySlugs: [...new Set([...current.installedCommunitySlugs, ...incoming.installedCommunitySlugs])],
    hasAnyConnector: current.hasAnyConnector || incoming.hasAnyConnector,
    githubUsername: current.githubUsername ?? incoming.githubUsername,
  };
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
