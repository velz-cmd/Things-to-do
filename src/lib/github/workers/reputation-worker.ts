import type { EvidenceBus } from "@/lib/evidence/bus";
import { evidenceId } from "@/lib/evidence/bus";
import type { WorkerEvidence } from "@/lib/evidence/types";
import { prSubjectId, userSubjectId } from "@/lib/evidence/normalizer";
import type { GitHubPullRequest } from "@/lib/github/types";

/** Worker 7 — Reputation Worker. Historical context only. New contributors are not punished. */
export function runReputationWorker(
  bus: EvidenceBus,
  pr: GitHubPullRequest,
  authorHistory: GitHubPullRequest[],
): void {
  const prior = authorHistory.filter(
    (p) => p.number !== pr.number && p.author.toLowerCase() === pr.author.toLowerCase(),
  );
  const priorMerged = prior.filter((p) => p.merged).length;
  const avgReviewEngagement =
    prior.length > 0
      ? prior.reduce((s, p) => s + p.reviewComments, 0) / prior.length
      : 0;
  const acceptanceRate =
    prior.length > 0 ? prior.filter((p) => p.merged).length / prior.length : null;

  const evidence: WorkerEvidence = {
    id: evidenceId("reputation", userSubjectId(pr.author), String(pr.number)),
    worker: "ReputationWorker",
    kind: "reputation",
    subjectId: prSubjectId(pr.number),
    confidence: priorMerged >= 3 ? 0.9 : priorMerged >= 1 ? 0.75 : 0.5,
    facts: [
      priorMerged === 0
        ? "First observed contribution in window — no historical penalty"
        : `Prior merged PRs in repo: ${priorMerged}`,
      acceptanceRate !== null
        ? `Historical merge rate: ${Math.round(acceptanceRate * 100)}%`
        : "Insufficient history for merge rate",
      avgReviewEngagement > 0
        ? `Avg review engagement on prior PRs: ${avgReviewEngagement.toFixed(1)}`
        : "No prior review thread data",
    ],
    metadata: {
      priorMerged,
      acceptanceRate,
      avgReviewEngagement,
      isNewContributor: priorMerged === 0,
    },
    producedAt: new Date().toISOString(),
  };
  bus.publish(evidence);
}
