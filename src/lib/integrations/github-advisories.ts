import { env } from "@/lib/integrations/config";

/**
 * GitHub's public Security Advisory Database (api.github.com/advisories) —
 * not the per-title regex heuristic in github/funding-activity.ts, which
 * only guesses "this PR mentions the word security." This connector reads
 * GitHub's own curated advisory records, filtered to exactly one already
 * canonically-confirmed npm package name (see fetchRepoNpmUsage /
 * canonical-identity.ts) so an advisory can never attach to the wrong
 * project by fuzzy name overlap.
 */

export type GithubSecurityAdvisory = {
  ghsaId: string;
  cveId: string | null;
  summary: string;
  severity: string;
  publishedAt: string;
  patchedVersions: string | null;
  htmlUrl: string;
};

type RawAdvisory = {
  ghsa_id: string;
  cve_id: string | null;
  summary: string;
  severity: string;
  published_at: string;
  html_url: string;
  vulnerabilities?: Array<{
    package?: { ecosystem?: string; name?: string };
    patched_versions?: string | null;
  }>;
};

async function advisoriesFetch(url: string): Promise<RawAdvisory[] | null> {
  const token = env("GITHUB_TOKEN");
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "RESOLVE-Capital-Flow",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return (await res.json()) as RawAdvisory[];
  } catch {
    return null;
  }
}

/**
 * Fetches advisories for exactly one confirmed npm package name. Only
 * accepts an advisory record whose vulnerability entry names this exact
 * package on the npm ecosystem - never a substring or fuzzy match.
 */
export async function fetchAdvisoriesForNpmPackage(
  packageName: string,
): Promise<GithubSecurityAdvisory[]> {
  const raw = await advisoriesFetch(
    `https://api.github.com/advisories?ecosystem=npm&affects=${encodeURIComponent(packageName)}&per_page=10`,
  );
  if (!raw) return [];

  return raw
    .filter((advisory) =>
      (advisory.vulnerabilities ?? []).some(
        (vuln) => vuln.package?.ecosystem === "npm" && vuln.package?.name === packageName,
      ),
    )
    .map((advisory) => {
      const match = (advisory.vulnerabilities ?? []).find(
        (vuln) => vuln.package?.ecosystem === "npm" && vuln.package?.name === packageName,
      );
      return {
        ghsaId: advisory.ghsa_id,
        cveId: advisory.cve_id,
        summary: advisory.summary,
        severity: advisory.severity,
        publishedAt: advisory.published_at,
        patchedVersions: match?.patched_versions ?? null,
        htmlUrl: advisory.html_url,
      };
    });
}
