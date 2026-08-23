import { ingestRepository } from "@/lib/github/adapter";
import { fetchGithubProject } from "@/lib/integrations/libraries-io";
import { findNpmPackagesForRepo } from "@/lib/integrations/npm-registry";
import { fetchAdvisoriesForNpmPackage } from "@/lib/integrations/github-advisories";
import { fetchFundingChannels } from "@/lib/integrations/github-funding-yaml";
import { computeRepoHealth } from "@/lib/github/repo-health";
import { buildGitHubFundingActivity } from "@/lib/github/funding-activity";
import type { FundingOpportunity, RepoIngestResult } from "@/lib/github/types";

/** High-value OSS repos — Phase 1 GitHub radar targets. */
export const RADAR_TARGETS = [
  { owner: "navidrome", repo: "navidrome" },
  { owner: "immich-app", repo: "immich" },
  { owner: "mastodon", repo: "mastodon" },
  { owner: "koel", repo: "koel" },
  { owner: "owncast", repo: "owncast" },
  { owner: "vercel", repo: "next.js" },
  { owner: "langchain-ai", repo: "langchain" },
  { owner: "supabase", repo: "supabase" },
];

/** Build the canonical persisted opportunity from one completed GitHub ingest. */
export function buildFundingOpportunity(
  ingest: RepoIngestResult,
  adoption?: FundingOpportunity["adoption"],
  security?: FundingOpportunity["security"],
  releases?: FundingOpportunity["releases"],
): FundingOpportunity {
  const health = computeRepoHealth(ingest);
  const highImpactPrs = ingest.pullRequests.filter(
    (pullRequest) =>
      pullRequest.additions + pullRequest.deletions >= 50 &&
      pullRequest.reviewComments >= 1,
  ).length;

  const unfundedMaintainers =
    health.maintainerCount <= 2 ? health.maintainerCount : 0;

  let priority: FundingOpportunity["priority"] = "medium";
  if (health.maintainerCount <= 1 && ingest.stars > 3000) priority = "critical";
  else if (health.fundingGapUsd > 5000 || highImpactPrs >= 3) priority = "high";

  return {
    id: `opp-${ingest.owner}-${ingest.repo}`,
    owner: ingest.owner,
    repo: ingest.repo,
    fullName: ingest.fullName,
    observedAt: ingest.ingestedAt,
    description: ingest.description ?? undefined,
    stars: ingest.stars,
    forks: ingest.forks,
    health,
    unfundedMaintainers,
    highImpactPrs,
    headline: health.headline,
    priority,
    live: true,
    activity: buildGitHubFundingActivity(ingest),
    dependencies: ingest.dependencies,
    adoption,
    security,
    releases,
  };
}

/**
 * Observes downstream adoption from Libraries.io. Returns undefined when the
 * connector is unconfigured or has no count for this repository - callers
 * must treat that as "not yet measurable", never as zero adoption and never
 * as a reason to substitute stars or merge counts.
 */
export async function observeRepositoryAdoption(
  owner: string,
  repo: string,
): Promise<FundingOpportunity["adoption"]> {
  const project = await fetchGithubProject(owner, repo).catch(() => null);
  const dependentRepoCount =
    project?.dependent_repos_count ?? project?.dependents_count;
  if (dependentRepoCount == null || dependentRepoCount <= 0) return undefined;
  return {
    dependentRepoCount,
    source: "Libraries.io",
    observedAt: new Date().toISOString(),
  };
}

/**
 * Observes GitHub Security Advisories with a published fix, scoped to
 * exactly this repository's canonically-confirmed npm package name(s).
 * Returns undefined when no connector produced an observation - callers
 * must treat that as "not yet observed", never as "no advisories exist".
 *
 * Phase 2 item 3 (security <-> release linking) conclusion: a genuinely
 * stronger claim ("Security fix release observed") would require proving
 * GHSA-real.patchedVersions actually satisfies this repository's live
 * published package version - i.e. real semver-range evaluation against
 * GitHub's advisory data. GHSA's patched_versions string is not one
 * standardized grammar (comma-joined ranges, "0" meaning "no fix", etc.),
 * and this repo has no declared semver dependency to evaluate it safely
 * (only a transitive, undeclared one exists in node_modules today). A
 * wrong range parse would produce a confidently false "fix confirmed"
 * claim, which is worse than the honest narrower signal this module
 * already reports. Conclusion recorded per the product spec's own
 * acceptable-outcome clause: security-release linking is NOT provable
 * with current authoritative, safely-parseable data. The narrower
 * "advisories_with_published_fix" signal (see impact-signals.ts) is the
 * correct and final claim until a properly declared, tested semver
 * dependency is added specifically for this purpose.
 */
export async function observeSecurityAdvisories(
  owner: string,
  repo: string,
): Promise<FundingOpportunity["security"]> {
  const packageNames = await findNpmPackagesForRepo(owner, repo).catch(() => []);
  if (!packageNames.length) return undefined;

  const results = await Promise.allSettled(
    packageNames.map((name) => fetchAdvisoriesForNpmPackage(name)),
  );
  const advisoriesWithPublishedFix = results
    .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof fetchAdvisoriesForNpmPackage>>> => r.status === "fulfilled")
    .flatMap((r) => r.value)
    .filter((advisory) => advisory.patchedVersions)
    .map((advisory) => ({
      ghsaId: advisory.ghsaId,
      cveId: advisory.cveId,
      patchedVersions: advisory.patchedVersions!,
      htmlUrl: advisory.htmlUrl,
    }));

  if (!advisoriesWithPublishedFix.length) return undefined;
  return { advisoriesWithPublishedFix, observedAt: new Date().toISOString() };
}

/**
 * Builds the durable release observation from the repository ingest that
 * already ran (RepoIngestResult.releases, populated by adapter.ts's own
 * GitHub Releases fetch - draft-excluded there already). Deliberately not
 * a second network call: the ingest already fetched this exact data, and
 * fetching it again per scan would duplicate an auth path that already
 * exists. Undefined when nothing was observed - never an empty array
 * standing in for "no releases exist".
 */
export function buildReleaseObservation(
  releases: RepoIngestResult["releases"],
): FundingOpportunity["releases"] {
  if (!releases.length) return undefined;
  return releases.map((release) => ({
    id: release.id,
    tagName: release.tagName,
    name: release.name,
    publishedAt: release.publishedAt ?? null,
    htmlUrl: release.sourceUrl,
    author: release.author,
    prerelease: release.prerelease,
  }));
}

/**
 * Observes real external funding channels from .github/FUNDING.yml.
 * Undefined when the file does not exist or nothing recognized was
 * parsed - never a fabricated "no funding" claim standing in for
 * "not observed".
 */
export async function observeExternalFundingContext(
  owner: string,
  repo: string,
): Promise<FundingOpportunity["externalFundingContext"]> {
  const channels = await fetchFundingChannels(owner, repo).catch(() => undefined);
  if (channels === undefined) return undefined;
  return { channels, observedAt: new Date().toISOString() };
}

export async function scanFundingOpportunity(
  owner: string,
  repo: string,
): Promise<FundingOpportunity | null> {
  const [ingest, adoption, security, externalFundingContext] = await Promise.all([
    ingestRepository(owner, repo, { prLimit: 8 }),
    observeRepositoryAdoption(owner, repo),
    observeSecurityAdvisories(owner, repo),
    observeExternalFundingContext(owner, repo),
  ]);
  if (!ingest) return null;
  const opportunity = buildFundingOpportunity(
    ingest,
    adoption,
    security,
    buildReleaseObservation(ingest.releases),
  );
  return externalFundingContext ? { ...opportunity, externalFundingContext } : opportunity;
}

export async function scanAllOpportunities(): Promise<FundingOpportunity[]> {
  const results = await Promise.all(
    RADAR_TARGETS.map((t) => scanFundingOpportunity(t.owner, t.repo)),
  );
  return results
    .filter((r): r is FundingOpportunity => r !== null)
    .sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2 };
      const pd = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (pd !== 0) return pd;
      return b.health.fundingGapUsd - a.health.fundingGapUsd;
    });
}
