import type { EvidenceBus } from "@/lib/evidence/bus";
import { evidenceId } from "@/lib/evidence/bus";
import type { WorkerEvidence } from "@/lib/evidence/types";
import { repoSubjectId } from "@/lib/evidence/normalizer";
import { computeRepoHealth } from "@/lib/github/repo-health";
import type { RepoIngestResult } from "@/lib/github/types";

/**
 * Worker 2 — Repository Worker. Repository context only.
 *
 * This worker used to publish "Funding gap estimate: $N" as a fact. That
 * number came from estimateOssFundingGap(stars, forks, mergedPrCount,
 * maintainerCount) - a dollar figure synthesized from popularity counters.
 * It never reached the confidence or reasoning engines, so it did not move
 * money, but it was rendered in the evidence inspector where a reader
 * reasonably treats a dollar amount as sourced. A number nobody observed
 * must not appear as proof, so it is no longer published.
 *
 * Stars and forks remain as repository context and are explicitly labelled
 * as attention rather than adoption, so they cannot be read as reach.
 */
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
      `Attention (not adoption): ${ingest.stars.toLocaleString()} stars · ${ingest.forks.toLocaleString()} forks`,
      `Open issues: ${ingest.openIssues}`,
      `Active maintainers: ${health.maintainerCount}`,
      `Merged pull requests observed: ${mergedPrs}`,
    ],
    metadata: {
      stars: ingest.stars,
      forks: ingest.forks,
      maintainerCount: health.maintainerCount,
      mergedPrs,
      openPrProxy,
    },
    producedAt: new Date().toISOString(),
  };
  bus.publish(evidence);
}
