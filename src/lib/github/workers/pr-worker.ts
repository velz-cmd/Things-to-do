import type { EvidenceBus } from "@/lib/evidence/bus";
import { evidenceId } from "@/lib/evidence/bus";
import type { WorkerEvidence } from "@/lib/evidence/types";
import { prSubjectId } from "@/lib/evidence/normalizer";
import type { GitHubPullRequest } from "@/lib/github/types";

/** Worker 3 — PR Worker. Contribution facts from merge metadata. No AI. */
export function runPrWorker(bus: EvidenceBus, pr: GitHubPullRequest): void {
  const lines = pr.additions + pr.deletions;
  const evidence: WorkerEvidence = {
    id: evidenceId("pr", prSubjectId(pr.number)),
    worker: "PrWorker",
    kind: "contribution",
    subjectId: prSubjectId(pr.number),
    confidence: pr.merged ? 0.95 : 0.6,
    facts: [
      `PR #${pr.number}: ${pr.title}`,
      `Author: @${pr.author}`,
      pr.merged ? "Status: merged" : "Status: not merged",
      `Diff: +${pr.additions}/-${pr.deletions} across ${pr.changedFiles} files`,
      `Review comments: ${pr.reviewComments}`,
      pr.labels.length ? `Labels: ${pr.labels.join(", ")}` : "No labels",
    ],
    metadata: {
      prNumber: pr.number,
      author: pr.author,
      merged: pr.merged,
      lines,
      changedFiles: pr.changedFiles,
      reviewComments: pr.reviewComments,
      labels: pr.labels,
    },
    producedAt: new Date().toISOString(),
  };
  bus.publish(evidence);
}
