import { env, isConfigured } from "@/lib/integrations/config";

export type NpmDownloadStats = {
  packageName: string;
  downloadsLastMonth: number;
  downloadsLastWeek: number;
};

const REGISTRY = "https://registry.npmjs.org";

async function npmFetch<T>(url: string): Promise<T | null> {
  const token = env("NPM_REGISTRY_TOKEN");
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "RESOLVE-Capital-Flow",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Search npm for packages linked to a GitHub repository. */
export async function findNpmPackagesForRepo(
  owner: string,
  repo: string,
): Promise<string[]> {
  const q = encodeURIComponent(`repository:github.com/${owner}/${repo}`);
  const data = await npmFetch<{
    objects?: { package: { name: string } }[];
  }>(`${REGISTRY}/-/v1/search?text=${q}&size=5`);
  return (data?.objects ?? []).map((o) => o.package.name).filter(Boolean);
}

export async function fetchNpmDownloadStats(
  packageName: string,
): Promise<NpmDownloadStats | null> {
  const [month, week] = await Promise.all([
    npmFetch<{ downloads: number }>(
      `https://api.npmjs.org/downloads/point/last-month/${encodeURIComponent(packageName)}`,
    ),
    npmFetch<{ downloads: number }>(
      `https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(packageName)}`,
    ),
  ]);
  if (!month && !week) return null;
  return {
    packageName,
    downloadsLastMonth: month?.downloads ?? 0,
    downloadsLastWeek: week?.downloads ?? 0,
  };
}

export async function fetchRepoNpmUsage(
  owner: string,
  repo: string,
): Promise<NpmDownloadStats | null> {
  const names = await findNpmPackagesForRepo(owner, repo);
  if (!names.length) return null;
  const stats = await Promise.all(names.map((n) => fetchNpmDownloadStats(n)));
  const valid = stats.filter((s): s is NpmDownloadStats => Boolean(s));
  if (!valid.length) return null;
  return valid.reduce((best, cur) =>
    cur.downloadsLastMonth > best.downloadsLastMonth ? cur : best,
  );
}

export function isNpmConfigured(): boolean {
  return isConfigured("NPM_REGISTRY_TOKEN");
}

export async function pingNpmRegistry(): Promise<{ ok: boolean; message: string }> {
  const stats = await fetchNpmDownloadStats("express");
  if (!stats) {
    return {
      ok: false,
      message: isNpmConfigured()
        ? "npm registry request failed"
        : "NPM_REGISTRY_TOKEN optional — public download API may rate-limit",
    };
  }
  return {
    ok: true,
    message: `npm connected · express ${stats.downloadsLastMonth.toLocaleString()} dl/mo`,
  };
}
