import { fetchGithubProject } from "@/lib/integrations/libraries-io";
import type { EvidenceBus } from "@/lib/evidence/bus";
import { evidenceId } from "@/lib/evidence/bus";
import type { WorkerEvidence } from "@/lib/evidence/types";
import { prSubjectId } from "@/lib/evidence/normalizer";
import type { GitHubPullRequest } from "@/lib/github/types";

/**
 * Worker 6 — Adoption observation.
 *
 * This worker previously synthesized a 0-100 "impact" score from repository
 * stars (`35 + log10(stars) * 12`) plus regex keyword bumps for
 * perf/security, and that number supplied 25% of contributor payout weight
 * via the reasoning engine. It has been removed: stars measure attention,
 * not whether a change is used or whom it benefited, so it could never
 * justify moving money, and it meant identical work paid differently
 * depending on how popular the host repository happened to be.
 *
 * What remains is the only genuinely authoritative thing this worker ever
 * had — the downstream dependent count from Libraries.io. It is published
 * as a sourced observation with its origin and timestamp, and it is
 * deliberately NOT collapsed into a score. Consumers surface it as evidence
 * a funder can inspect (see src/lib/discover/impact/impact-signals.ts),
 * which also keeps its repository-level scope visible rather than implying
 * this particular pull request reached those dependents.
 *
 * When Libraries.io has no count, no evidence is published at all. Absence
 * means "not yet measurable", never zero adoption.
 */
export async function runImpactWorker(
  bus: EvidenceBus,
  pr: GitHubPullRequest,
  repoContext: { fullName: string; librariesDependents?: number },
): Promise<void> {
  let dependentRepoCount = repoContext.librariesDependents;

  if (dependentRepoCount == null || dependentRepoCount <= 0) {
    const [owner, repo] = repoContext.fullName.split("/");
    if (owner && repo) {
      const project = await fetchGithubProject(owner, repo).catch(() => null);
      dependentRepoCount =
        project?.dependent_repos_count ?? project?.dependents_count ?? undefined;
    }
  }

  if (dependentRepoCount == null || dependentRepoCount <= 0) return;

  const observedAt = new Date().toISOString();
  const evidence: WorkerEvidence = {
    id: evidenceId("impact", prSubjectId(pr.number)),
    worker: "ImpactWorker",
    kind: "impact",
    subjectId: prSubjectId(pr.number),
    // Confidence describes the observation itself, which came directly from
    // a registry API rather than being inferred.
    confidence: 0.9,
    facts: [
      `${dependentRepoCount.toLocaleString()} dependent repositories recorded for ${repoContext.fullName} (source: Libraries.io, observed ${observedAt}). Repository-scoped: this does not establish that this pull request reached those dependents.`,
    ],
    metadata: {
      dependentRepoCount,
      source: "Libraries.io",
      scope: "repository",
      observedAt,
    },
    producedAt: observedAt,
  };
  bus.publish(evidence);
}
