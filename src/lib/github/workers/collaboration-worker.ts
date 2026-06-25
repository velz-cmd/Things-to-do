import type { EvidenceBus } from "@/lib/evidence/bus";
import { evidenceId } from "@/lib/evidence/bus";
import type { WorkerEvidence } from "@/lib/evidence/types";
import { prSubjectId } from "@/lib/evidence/normalizer";
import type { GitHubPullRequest } from "@/lib/github/types";

/** Worker 5 — Collaboration Worker. Review thread quality only. */
export function runCollaborationWorker(bus: EvidenceBus, pr: GitHubPullRequest): void {
  const reviews = pr.reviewComments;
  const hasDiscussion = reviews >= 2;
  const maintainerEngaged = reviews >= 1 && pr.merged;

  let collaboration = 40;
  if (hasDiscussion) collaboration += 25;
  if (maintainerEngaged) collaboration += 20;
  if (reviews >= 5) collaboration += 15;
  collaboration = Math.min(100, collaboration);

  const evidence: WorkerEvidence = {
    id: evidenceId("collaboration", prSubjectId(pr.number)),
    worker: "CollaborationWorker",
    kind: "collaboration",
    subjectId: prSubjectId(pr.number),
    confidence: reviews > 0 ? 0.85 : 0.55,
    facts: [
      `Review comments: ${reviews}`,
      hasDiscussion ? "Multi-turn discussion detected" : "Limited or no discussion",
      maintainerEngaged ? "Merged with review engagement" : "Merged without visible review thread",
      `Collaboration score: ${collaboration}/100`,
    ],
    metadata: {
      reviewComments: reviews,
      collaboration,
      hasDiscussion,
      maintainerEngaged,
    },
    producedAt: new Date().toISOString(),
  };
  bus.publish(evidence);
}
