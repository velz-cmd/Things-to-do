import type { RepoHealthScore, RepoIngestResult } from "@/lib/github/types";

function daysSince(iso?: string): number | undefined {
  if (!iso) return undefined;
  return (Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000);
}

function gradeFromScore(score: number): RepoHealthScore["grade"] {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

/** Repository health — finds high-value, underfunded OSS opportunities. */
export function computeRepoHealth(ingest: RepoIngestResult): RepoHealthScore {
  const maintainerCount = ingest.contributors.filter((c) => {
    const prs = ingest.pullRequests.filter(
      (p) => p.author.toLowerCase() === c.login.toLowerCase(),
    );
    return prs.length >= 2;
  }).length;

  const daysSincePush = daysSince(ingest.pushedAt);
  const issueBacklog = ingest.openIssues;
  const stars = ingest.stars;
  const forks = ingest.forks;

  const activityScore =
    daysSincePush === undefined ? 50 : daysSincePush < 14 ? 95 : daysSincePush < 60 ? 75 : daysSincePush < 180 ? 50 : 25;

  const adoptionScore = Math.min(100, Math.log10(stars + 1) * 28 + Math.log10(forks + 1) * 12);
  const maintainerStress =
    maintainerCount <= 1 && stars > 1000 ? 20 : maintainerCount <= 2 && stars > 500 ? 45 : 75;
  const backlogPenalty = issueBacklog > 200 ? 30 : issueBacklog > 50 ? 55 : 85;

  const mergeTimes = ingest.pullRequests
    .filter((p) => p.mergedAt)
    .slice(0, 10);
  const avgMergeDays =
    mergeTimes.length > 0
      ? mergeTimes.reduce((s, p) => s + (daysSince(p.mergedAt) ?? 30), 0) / mergeTimes.length
      : undefined;

  const responsiveness = avgMergeDays !== undefined && avgMergeDays < 14 ? 90 : avgMergeDays !== undefined && avgMergeDays < 45 ? 65 : 40;

  const score = Math.round(
    activityScore * 0.2 +
      adoptionScore * 0.35 +
      maintainerStress * 0.25 +
      backlogPenalty * 0.1 +
      responsiveness * 0.1,
  );

  const fundingGapUsd = Math.round(
    stars * 0.5 + forks * 2 + (maintainerCount <= 1 ? stars * 0.3 : 0),
  );

  const headline =
    maintainerCount <= 1 && stars > 5000
      ? `${stars.toLocaleString()}★ · ${maintainerCount} active maintainer · critical funding gap`
      : stars > 1000
        ? `${stars.toLocaleString()}★ · ${maintainerCount} maintainers · high downstream usage`
        : `${stars.toLocaleString()}★ · ${ingest.pullRequests.length} recent merged PRs`;

  return {
    score,
    grade: gradeFromScore(score),
    maintainerCount,
    avgMergeDays: avgMergeDays !== undefined ? Math.round(avgMergeDays) : undefined,
    fundingGapUsd,
    headline,
    signals: [
      { label: "Stars", value: stars.toLocaleString(), impact: stars > 1000 ? "positive" : "neutral" },
      { label: "Forks", value: forks.toLocaleString(), impact: forks > 100 ? "positive" : "neutral" },
      { label: "Open issues", value: String(issueBacklog), impact: issueBacklog > 100 ? "negative" : "neutral" },
      { label: "Maintainers", value: String(maintainerCount), impact: maintainerCount <= 1 ? "negative" : "positive" },
      { label: "Last push", value: daysSincePush !== undefined ? `${Math.round(daysSincePush)}d ago` : "—", impact: daysSincePush !== undefined && daysSincePush < 30 ? "positive" : "negative" },
      { label: "Est. funding gap", value: `$${fundingGapUsd.toLocaleString()}`, impact: "negative" },
    ],
  };
}
