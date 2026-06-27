import {
  fetchUserMemory,
  readSessionMemory,
  saveUserMemory,
  type ResolveWorkspaceMemory,
} from "@/lib/resolve/workspace-memory";

const WORKSPACE_FIELDS: (keyof ResolveWorkspaceMemory)[] = [
  "draft",
  "pendingTask",
  "activeTaskId",
  "activeMissionId",
  "activeEcosystemId",
  "classification",
  "showVault",
  "showMissions",
];

function pickWorkspaceFields(
  source: ResolveWorkspaceMemory
): ResolveWorkspaceMemory {
  const out: ResolveWorkspaceMemory = {};
  for (const key of WORKSPACE_FIELDS) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== "") {
      (out as Record<string, unknown>)[key] = value;
    }
  }
  return out;
}

/** Merge guest/local workspace state into the signed-in user's server memory once. */
export async function syncLocalMemoryToServer(): Promise<void> {
  const local = pickWorkspaceFields(readSessionMemory());
  if (Object.keys(local).length === 0) return;

  const remote = pickWorkspaceFields(await fetchUserMemory());
  const merged: ResolveWorkspaceMemory = { ...local, ...remote };

  if (Object.keys(merged).length === 0) return;
  await saveUserMemory(merged);
}
