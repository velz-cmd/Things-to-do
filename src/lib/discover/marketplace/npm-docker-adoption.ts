import "server-only";

import { cacheGetOrSetResilient } from "@/lib/cache/kv";
import { fetchRepoNpmUsage } from "@/lib/integrations/npm-registry";
import { fetchDockerUsageForGithubRepo } from "@/lib/integrations/docker-hub";
import { impactSignal, buildImpactProfile } from "@/lib/discover/impact/impact-signals";
import type { MarketplaceOpportunity } from "./contracts";

/**
 * Enriches GitHub Verified Work items with real npm download counts and
 * Docker Hub pull counts, when a connector actually observed them - never
 * invented, never a blended "usage score" (see collectUpstreamUsageSignals,
 * which computes exactly that composite for a different, Mission-facing
 * feature; that composite must never leak into Discover's impactProfile,
 * which only carries individually-sourced, individually-timestamped counts).
 *
 * Bounded to a handful of distinct repositories per call, and each
 * connector result is cached far longer than the outer 60s source cache,
 * so this never turns into a per-request fan-out against npm/Docker Hub.
 */
const MAX_REPOS_PER_LOAD = 6;
const ADOPTION_CACHE_TTL_SECONDS = 21_600; // 6 hours

type NpmDockerAdoption = {
  npm?: { packageName: string; downloadsLastMonth: number };
  docker?: { namespace: string; repository: string; pullCount: number };
};

async function loadAdoptionForRepo(fullName: string): Promise<NpmDockerAdoption> {
  const [owner, repo] = fullName.split("/");
  if (!owner || !repo) return {};
  return cacheGetOrSetResilient(
    `discover:marketplace:npm-docker-adoption:v1:${fullName.toLowerCase()}`,
    ADOPTION_CACHE_TTL_SECONDS,
    async () => {
      const [npm, docker] = await Promise.allSettled([
        fetchRepoNpmUsage(owner, repo),
        fetchDockerUsageForGithubRepo(owner, repo),
      ]);
      const result: NpmDockerAdoption = {};
      if (npm.status === "fulfilled" && npm.value?.downloadsLastMonth) {
        result.npm = {
          packageName: npm.value.packageName,
          downloadsLastMonth: npm.value.downloadsLastMonth,
        };
      }
      if (docker.status === "fulfilled" && docker.value?.pullCount) {
        result.docker = {
          namespace: docker.value.namespace,
          repository: docker.value.repository,
          pullCount: docker.value.pullCount,
        };
      }
      return result;
    },
    { staleSeconds: ADOPTION_CACHE_TTL_SECONDS * 4 },
  );
}

export async function attachNpmDockerAdoption(
  items: MarketplaceOpportunity[],
): Promise<MarketplaceOpportunity[]> {
  const candidateRepos = [
    ...new Set(
      items
        .filter(
          (item) =>
            item.marketplaceKind === "verified_work" &&
            item.source.type === "github_evidence" &&
            item.repository &&
            (!item.impactProfile || item.impactProfile.measurable === false),
        )
        .map((item) => item.repository!),
    ),
  ].slice(0, MAX_REPOS_PER_LOAD);

  if (!candidateRepos.length) return items;

  const observedAt = new Date().toISOString();
  const byRepo = new Map<string, NpmDockerAdoption>();
  await Promise.all(
    candidateRepos.map(async (fullName) => {
      try {
        byRepo.set(fullName, await loadAdoptionForRepo(fullName));
      } catch {
        byRepo.set(fullName, {});
      }
    }),
  );

  return items.map((item) => {
    if (!item.repository || !byRepo.has(item.repository)) return item;
    const adoption = byRepo.get(item.repository)!;
    if (!adoption.npm && !adoption.docker) return item;

    const npmSignal = adoption.npm
      ? impactSignal({
          id: "npm_downloads_last_month",
          label: "npm downloads (last month)",
          count: adoption.npm.downloadsLastMonth,
          scope: "repository",
          source: "npm registry",
          sourceUrl: `https://www.npmjs.com/package/${adoption.npm.packageName}`,
          observedAt,
        })
      : null;
    const dockerSignal = adoption.docker
      ? impactSignal({
          id: "docker_pulls",
          label: "Docker Hub pulls",
          count: adoption.docker.pullCount,
          scope: "repository",
          source: "Docker Hub",
          sourceUrl: `https://hub.docker.com/r/${adoption.docker.namespace}/${adoption.docker.repository}`,
          observedAt,
        })
      : null;

    if (!npmSignal && !dockerSignal) return item;

    const existingSignals =
      item.impactProfile?.measurable === true ? item.impactProfile.signals : [];
    return {
      ...item,
      impactProfile: buildImpactProfile(
        [...existingSignals, npmSignal, dockerSignal],
        "No connector has produced an adoption or outcome observation for this work yet, so its impact is not yet measurable.",
      ),
    };
  });
}
