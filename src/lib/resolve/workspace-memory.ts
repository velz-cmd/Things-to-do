import type { TaskClassification } from "@/lib/tasks/classifier";

export type ResolveWorkspaceMemory = {
  draft?: string;
  pendingTask?: string | null;
  activeTaskId?: string | null;
  activeMissionId?: string | null;
  classification?: TaskClassification | null;
  showVault?: boolean;
  showMissions?: boolean;
  updatedAt?: string;
};

const SESSION_KEY = "resolve.workspace.memory";

export function readSessionMemory(): ResolveWorkspaceMemory {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as ResolveWorkspaceMemory;
  } catch {
    return {};
  }
}

export function writeSessionMemory(patch: ResolveWorkspaceMemory) {
  if (typeof window === "undefined") return;
  try {
    const prev = readSessionMemory();
    const next: ResolveWorkspaceMemory = {
      ...prev,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
}

export async function fetchUserMemory(): Promise<ResolveWorkspaceMemory> {
  const res = await fetch("/api/user/memory");
  if (!res.ok) return {};
  const data = await res.json();
  return (data.memory ?? {}) as ResolveWorkspaceMemory;
}

export async function saveUserMemory(patch: ResolveWorkspaceMemory) {
  const res = await fetch("/api/user/memory", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memory: patch }),
  });
  if (!res.ok) return false;
  return true;
}
