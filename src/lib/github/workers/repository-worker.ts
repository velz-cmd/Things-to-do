import type { EvidenceBus } from "@/lib/evidence/bus";
import { evidenceId } from "@/lib/evidence/bus";
import type { WorkerEvidence } from "@/lib/evidence/types";
import { repoSubjectId } from "@/lib/evidence/normalizer";
import { computeRepoHealth } from "@/lib/github/repo-health";
import type { RepoIngestResult } from "@/lib/github/types";

/** Worker 2 — Repository Worker. Facts about repo health and adoption only. */
export function runRepositoryWorker(bus: EvidenceBus, ingest: RepoIngestResult): void {
  const health = computeRepoHealth(ingest);
  const mergedPrs = ingest.pullRequests.length;
  const openPrProxy = ingest.pullRequests.filter((p) => !p.merged).length;

  const evidence: WorkerEvidence = {
    id: evidenceId("repository", repoSubjectId(ingest.fullName)),
    worker: "RepositoryWorker",
    kind: "repository",
    subjectId: repoSubjectId(ingest.fullName),
    confidence: 0.92,
    facts: [
      `Stars: ${ingest.stars.toLocaleString()} · Forks: ${ingest.forks.toLocaleString()}`,
      `Open issues: ${ingest.openIssues}`,
      `Health grade: ${health.grade} (${health.score}/100)`,
      `Active maintainers: ${health.maintainerCount}`,
      `Funding gap estimate: $${health.fundingGapUsd.toLocaleString()}`,
      health.headline,
    ],
    metadata: {
      stars: ingest.stars,
      forks: ingest.forks,
      healthScore: health.score,
      healthGrade: health.grade,
      maintainerCount: health.maintainerCount,
      fundingGapUsd: health.fundingGapUsd,
      mergedPrs,
      openPrProxy,
    },
    producedAt: new Date().toISOString(),
  };
  bus.publish(evidence);
}
