export type RecentWorkspace = {
  id: string;
  label: string;
  type: "github" | "navidrome" | "other";
  owner?: string;
  repo?: string;
  updatedAt: string;
};

const STORAGE_KEY = "resolve-recent-workspaces";

export function loadRecentWorkspaces(): RecentWorkspace[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RecentWorkspace[]) : [];
  } catch {
    return [];
  }
}

export function saveRecentWorkspace(entry: Omit<RecentWorkspace, "updatedAt">) {
  const list = loadRecentWorkspaces().filter((w) => w.id !== entry.id);
  list.unshift({ ...entry, updatedAt: new Date().toISOString() });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 8)));
}
