import { ingestRepository } from "@/lib/github/adapter";
import { computeRepoHealth } from "@/lib/github/repo-health";
import { buildGitHubFundingActivity } from "@/lib/github/funding-activity";
import type { FundingOpportunity } from "@/lib/github/types";

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

export async function scanFundingOpportunity(
  owner: string,
  repo: string,
): Promise<FundingOpportunity | null> {
  const ingest = await ingestRepository(owner, repo, { prLimit: 8 });
  if (!ingest) return null;

  const health = computeRepoHealth(ingest);
  const highImpactPrs = ingest.pullRequests.filter(
    (p) => p.additions + p.deletions >= 50 && p.reviewComments >= 1,
  ).length;

  const unfundedMaintainers = health.maintainerCount <= 2 ? health.maintainerCount : 0;

  let priority: FundingOpportunity["priority"] = "medium";
  if (health.maintainerCount <= 1 && ingest.stars > 3000) priority = "critical";
  else if (health.fundingGapUsd > 5000 || highImpactPrs >= 3) priority = "high";

  return {
    id: `opp-${owner}-${repo}`,
    owner,
    repo,
    fullName: ingest.fullName,
    description: ingest.description,
    stars: ingest.stars,
    forks: ingest.forks,
    health,
    unfundedMaintainers,
    highImpactPrs,
    headline: health.headline,
    priority,
    live: true,
    activity: buildGitHubFundingActivity(ingest),
  };
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
