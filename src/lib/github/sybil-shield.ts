import type { GitHubContributor, GitHubPullRequest, TrustScore } from "@/lib/github/types";

function accountAgeYears(createdAt?: string): number {
  if (!createdAt) return 0;
  const ms = Date.now() - new Date(createdAt).getTime();
  return ms / (365.25 * 24 * 60 * 60 * 1000);
}

/** Sybil-resistant trust score (0–100) from GitHub identity signals. */
export function computeTrustScore(
  contributor: GitHubContributor,
  mergedPrs: GitHubPullRequest[],
): TrustScore {
  const authorPrs = mergedPrs.filter(
    (p) => p.author.toLowerCase() === contributor.login.toLowerCase(),
  );
  const mergedCount = authorPrs.length;
  const reviewEngagement = authorPrs.reduce((s, p) => s + p.reviewComments, 0);
  const ageYears = accountAgeYears(contributor.accountCreatedAt);
  const repos = contributor.publicRepos ?? 0;

  const ageScore = Math.min(100, ageYears * 18);
  const prScore = Math.min(100, mergedCount * 8 + Math.log10(mergedCount + 1) * 15);
  const diversityScore = Math.min(100, repos * 3);
  const engagementScore = Math.min(100, reviewEngagement * 4);
  const maintainerApproval = authorPrs.some((p) => p.reviewComments >= 2) ? 85 : 45;

  const weighted =
    ageScore * 0.25 +
    prScore * 0.3 +
    diversityScore * 0.15 +
    engagementScore * 0.15 +
    maintainerApproval * 0.15;

  const score = Math.round(Math.max(5, Math.min(100, weighted)));
  const confidence = Math.min(
    0.98,
    0.4 + (mergedCount > 0 ? 0.2 : 0) + (ageYears > 0.5 ? 0.2 : 0) + (repos > 2 ? 0.18 : 0),
  );

  let status: TrustScore["status"] = "trusted";
  if (score < 35) status = "sybil_risk";
  else if (score < 55) status = "low_trust";

  return {
    login: contributor.login,
    score,
    confidence,
    status,
    signals: [
      { label: "Account age", value: ageYears >= 1 ? `${ageYears.toFixed(1)}y` : "< 1y", weight: 0.25 },
      { label: "Merged PRs", value: String(mergedCount), weight: 0.3 },
      { label: "Public repos", value: String(repos), weight: 0.15 },
      { label: "Review threads", value: String(reviewEngagement), weight: 0.15 },
      { label: "Maintainer engagement", value: maintainerApproval >= 80 ? "Yes" : "Limited", weight: 0.15 },
    ],
  };
}

export function computeTrustScores(
  contributors: GitHubContributor[],
  mergedPrs: GitHubPullRequest[],
): Map<string, TrustScore> {
  const map = new Map<string, TrustScore>();
  for (const c of contributors) {
    map.set(c.login.toLowerCase(), computeTrustScore(c, mergedPrs));
  }
  for (const pr of mergedPrs) {
    const key = pr.author.toLowerCase();
    if (!map.has(key)) {
      map.set(
        key,
        computeTrustScore({ login: pr.author, id: pr.authorId }, mergedPrs),
      );
    }
  }
  return map;
}
