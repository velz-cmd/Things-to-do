import type { EvidenceBus } from "@/lib/evidence/bus";
import { evidenceId } from "@/lib/evidence/bus";
import type { WorkerEvidence } from "@/lib/evidence/types";
import { userSubjectId } from "@/lib/evidence/normalizer";
import type { GitHubContributor, GitHubPullRequest, RepoIngestResult } from "@/lib/github/types";

function accountAgeYears(createdAt?: string): number {
  if (!createdAt) return 0;
  return (Date.now() - new Date(createdAt).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
}

/**
 * Worker 1 — Identity Worker
 * Enriches identity evidence only. Never rejects. Never scores payouts.
 * Does NOT use commits/day (Cursor-assisted humans would false-positive).
 */
export function runIdentityWorker(
  bus: EvidenceBus,
  ingest: RepoIngestResult,
  allPrs: GitHubPullRequest[],
): void {
  const seen = new Set<string>();

  const enrich = (contributor: GitHubContributor) => {
    const key = contributor.login.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    const authorPrs = allPrs.filter((p) => p.author.toLowerCase() === key);
    const mergedCount = authorPrs.length;
    const ageYears = accountAgeYears(contributor.accountCreatedAt);
    const repos = contributor.publicRepos ?? 0;
    const followers = contributor.followers ?? 0;

    const ageSignal = ageYears >= 3 ? 0.9 : ageYears >= 1 ? 0.75 : ageYears >= 0.08 ? 0.55 : 0.35;
    const historySignal = mergedCount >= 20 ? 0.92 : mergedCount >= 5 ? 0.78 : mergedCount >= 1 ? 0.62 : 0.45;
    const diversitySignal = repos >= 10 ? 0.85 : repos >= 3 ? 0.7 : repos >= 1 ? 0.55 : 0.4;
    const socialSignal = followers >= 50 ? 0.8 : followers >= 10 ? 0.65 : 0.5;

    const confidence = Math.min(
      0.95,
      ageSignal * 0.3 + historySignal * 0.35 + diversitySignal * 0.2 + socialSignal * 0.15,
    );

    const evidence: WorkerEvidence = {
      id: evidenceId("identity", userSubjectId(contributor.login)),
      worker: "IdentityWorker",
      kind: "identity",
      subjectId: userSubjectId(contributor.login),
      confidence,
      facts: [
        `Account age: ${ageYears >= 1 ? `${ageYears.toFixed(1)} years` : ageYears > 0 ? `${Math.round(ageYears * 365)} days` : "unknown"}`,
        `Merged PRs in window: ${mergedCount}`,
        `Public repositories: ${repos}`,
        `Followers: ${followers}`,
        mergedCount === 0 ? "New contributor — insufficient history (not penalized)" : "Contribution history present",
      ],
      metadata: {
        ageYears,
        mergedCount,
        publicRepos: repos,
        followers,
        identityConfidence: confidence,
      },
      producedAt: new Date().toISOString(),
    };
    bus.publish(evidence);
  };

  for (const c of ingest.contributors) enrich(c);
  for (const pr of allPrs) {
    if (!seen.has(pr.author.toLowerCase())) {
      enrich({ login: pr.author, id: pr.authorId });
    }
  }
}
