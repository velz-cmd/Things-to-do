import "server-only";

import { cacheGetOrSetResilient } from "@/lib/cache/kv";
import { findNpmPackagesForRepo } from "@/lib/integrations/npm-registry";
import { fetchAdvisoriesForNpmPackage } from "@/lib/integrations/github-advisories";
import { impactSignal, buildImpactProfile } from "@/lib/discover/impact/impact-signals";
import type { MarketplaceOpportunity } from "./contracts";

/**
 * Phase 2 (Software Economic Graph): resolved security advisories.
 *
 * This is deliberately distinct from the title/label keyword heuristic in
 * src/lib/github/funding-activity.ts (classifyPullRequest/classifyIssue),
 * which only guesses "the word security appears here." This connector
 * reads GitHub's own curated public advisory database, scoped to exactly
 * one already-canonically-confirmed npm package name per repository (see
 * findNpmPackagesForRepo, which already enforces repository-link identity
 * matching) - never a fuzzy name match, and never counted as impact merely
 * because a title mentions security.
 *
 * A resolved advisory (one with a patched version) is repository-scoped
 * evidence that a real security fix shipped and was tracked authoritatively
 * - not proof of who benefited or how much. It composes alongside, not in
 * place of, dependent-repository/npm/docker adoption signals.
 */
const MAX_REPOS_PER_LOAD = 6;
const ADVISORY_CACHE_TTL_SECONDS = 21_600; // 6 hours

async function loadResolvedAdvisoryCount(fullName: string): Promise<number> {
  const [owner, repo] = fullName.split("/");
  if (!owner || !repo) return 0;
  return cacheGetOrSetResilient(
    `discover:marketplace:security-advisories:v1:${fullName.toLowerCase()}`,
    ADVISORY_CACHE_TTL_SECONDS,
    async () => {
      const packageNames = await findNpmPackagesForRepo(owner, repo);
      if (!packageNames.length) return 0;
      const results = await Promise.allSettled(
        packageNames.map((name) => fetchAdvisoriesForNpmPackage(name)),
      );
      let resolved = 0;
      for (const result of results) {
        if (result.status !== "fulfilled") continue;
        resolved += result.value.filter((advisory) => advisory.patchedVersions).length;
      }
      return resolved;
    },
    { staleSeconds: ADVISORY_CACHE_TTL_SECONDS * 4 },
  );
}

export async function attachSecurityAdvisorySignals(
  items: MarketplaceOpportunity[],
): Promise<MarketplaceOpportunity[]> {
  const candidateRepos = [
    ...new Set(
      items
        .filter(
          (item) =>
            item.marketplaceKind === "verified_work" &&
            item.source.type === "github_evidence" &&
            item.repository,
        )
        .map((item) => item.repository!),
    ),
  ].slice(0, MAX_REPOS_PER_LOAD);

  if (!candidateRepos.length) return items;

  const observedAt = new Date().toISOString();
  const byRepo = new Map<string, number>();
  await Promise.all(
    candidateRepos.map(async (fullName) => {
      try {
        byRepo.set(fullName, await loadResolvedAdvisoryCount(fullName));
      } catch {
        byRepo.set(fullName, 0);
      }
    }),
  );

  return items.map((item) => {
    if (!item.repository || !byRepo.has(item.repository)) return item;
    const resolvedCount = byRepo.get(item.repository)!;
    if (!resolvedCount) return item;

    const signal = impactSignal({
      id: "resolved_security_advisories",
      label: "Resolved security advisories",
      count: resolvedCount,
      scope: "repository",
      source: "GitHub Security Advisories",
      sourceUrl: `https://github.com/${item.repository}/security/advisories`,
      observedAt,
    });
    if (!signal) return item;

    const existingSignals =
      item.impactProfile?.measurable === true ? item.impactProfile.signals : [];
    return {
      ...item,
      impactProfile: buildImpactProfile(
        [...existingSignals, signal],
        "No connector has produced an adoption or outcome observation for this work yet, so its impact is not yet measurable.",
      ),
    };
  });
}
