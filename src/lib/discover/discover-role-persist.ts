import type { DiscoverRole } from "@/lib/discover/role-filters";

const STORAGE_KEY = "resolve-discover-role";

export function loadPersistedDiscoverRole(): DiscoverRole | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (
      raw === "community" ||
      raw === "funder" ||
      raw === "founder" ||
      raw === "operator" ||
      raw === "dao"
    ) {
      return raw;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function persistDiscoverRole(role: DiscoverRole): void {
  if (typeof window === "undefined" || role === "all") return;
  try {
    localStorage.setItem(STORAGE_KEY, role);
  } catch {
    /* ignore */
  }
}
