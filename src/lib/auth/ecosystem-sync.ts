import { loadEcosystems } from "@/lib/mission/ecosystems";

/** Push guest localStorage workspaces to Postgres once after sign-in. */
export async function syncLocalEcosystemsToServer(): Promise<void> {
  if (typeof window === "undefined") return;

  const key = "resolve-ecosystems-synced";
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
