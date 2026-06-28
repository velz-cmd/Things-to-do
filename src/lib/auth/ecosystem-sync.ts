import { loadEcosystems } from "@/lib/mission/ecosystems";

/** Push guest localStorage workspaces to Postgres once per user after sign-in. */
export async function syncLocalEcosystemsToServer(userId: string): Promise<void> {
  if (typeof window === "undefined" || !userId) return;

  const key = `resolve-ecosystems-synced.${userId}`;
  if (localStorage.getItem(key) === "1") return;

  const ecosystems = loadEcosystems();
  const res = await fetch("/api/mission/ecosystems/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      ecosystems: ecosystems.map((e) => ({
        id: e.id,
        name: e.name,
        kind: e.kind,
        keywords: e.keywords,
      })),
    }),
  });

  if (res.ok) {
    localStorage.setItem(key, "1");
  }
}

export function clearGuestSessionStorage() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("resolve.workspace.memory");
    localStorage.removeItem("resolve-ecosystems-synced");
    localStorage.removeItem("resolve.signin.verifyPending");
  } catch {
    /* ignore */
  }
}
