import { env, INTEGRATIONS } from "@/lib/integrations/config";

export type LibrariesIoGithubRepo = {
  name: string;
  full_name?: string;
  rank?: number;
  stargazers_count?: number;
  forks_count?: number;
  language?: string;
  dependents_count?: number;
  dependent_repos_count?: number;
};

export type LibrariesIoPackage = {
  name: string;
  platform: string;
  dependents_count?: number;
  dependent_repos_count?: number;
  rank?: number;
  repository_url?: string;
};

const BASE = "https://libraries.io/api";

async function librariesFetch<T>(url: string): Promise<T | null> {
  const apiKey = env("LIBRARIES_IO_API_KEY");
  if (!apiKey) return null;
  const sep = url.includes("?") ? "&" : "?";
  try {
    const res = await fetch(`${url}${sep}api_key=${apiKey}`, {
      headers: { Accept: "application/json", "User-Agent": "RESOLVE-Capital-Flow" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      console.warn(`[libraries.io] HTTP ${res.status} ${url}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (e) {
    console.warn("[libraries.io] fetch failed:", e);
    return null;
  }
}

/** GET /api/GitHub/:owner/:repo — rank, stars, ecosystem position */
export async function fetchGithubProject(
  owner: string,
  repo: string,
): Promise<LibrariesIoGithubRepo | null> {
  return librariesFetch<LibrariesIoGithubRepo>(
    `${BASE}/GitHub/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
  );
}

/** Search package managers linked to a GitHub repo (NPM, Go, etc.) */
export async function fetchPackageDependentsForRepo(
  owner: string,
  repo: string,
): Promise<{ platform: string; name: string; dependents: number } | null> {
  const search = await librariesFetch<{ results?: LibrariesIoPackage[] }>(
    `${BASE}/search?q=${encodeURIComponent(`${owner}/${repo}`)}`,
  );
  const results = search?.results ?? [];
  const match = results.find(
    (p) =>
      p.repository_url?.toLowerCase().includes(`${owner}/${repo}`.toLowerCase()) &&
      (p.dependents_count ?? 0) > 0,
  );
  if (!match?.dependents_count) return null;
  return {
    platform: match.platform,
    name: match.name,
    dependents: match.dependents_count,
  };
}

export async function pingLibrariesIo(): Promise<{ ok: boolean; message: string; sample?: string }> {
  if (!INTEGRATIONS.librariesIo()) {
    return { ok: false, message: "LIBRARIES_IO_API_KEY not set" };
  }

  const [gh, pkg] = await Promise.all([
    fetchGithubProject("navidrome", "navidrome"),
    fetchPackageDependentsForRepo("expressjs", "express"),
  ]);

  if (!gh && !pkg) {
    return { ok: false, message: "Libraries.io request failed" };
  }

  const parts: string[] = [];
  if (gh?.rank != null) parts.push(`navidrome rank #${gh.rank}`);
  if (pkg) parts.push(`${pkg.platform}/${pkg.name}: ${pkg.dependents.toLocaleString()} dependents`);

  return {
    ok: true,
    message: "Libraries.io connected",
    sample: parts.join(" · ") || "API reachable",
  };
}
