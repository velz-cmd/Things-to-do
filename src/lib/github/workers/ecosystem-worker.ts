import { fetchGithubProject, fetchPackageDependentsForRepo } from "@/lib/integrations/libraries-io";
import { fetchRepoResearchSignal } from "@/lib/integrations/openalex";
import type { EvidenceBus } from "@/lib/evidence/bus";
import { evidenceId } from "@/lib/evidence/bus";
import type { WorkerEvidence } from "@/lib/evidence/types";
import { repoSubjectId } from "@/lib/evidence/normalizer";

/** Enrich repository evidence with Libraries.io + OpenAlex (repo-level, once per pipeline). */
export async function runRepoEcosystemWorker(
  bus: EvidenceBus,
  owner: string,
  repo: string,
  stars: number,
): Promise<void> {
  const [lib, pkg, research] = await Promise.all([
    fetchGithubProject(owner, repo),
    fetchPackageDependentsForRepo(owner, repo),
    fetchRepoResearchSignal(owner, repo),
  ]);

  const facts: string[] = [];
  const metadata: Record<string, unknown> = { stars };

  if (lib?.rank != null) {
    facts.push(`Libraries.io ecosystem rank: #${lib.rank}`);
    metadata.librariesIoRank = lib.rank;
  }
  if (lib?.stargazers_count != null) {
    metadata.librariesIoStars = lib.stargazers_count;
  }

  if (pkg) {
    facts.push(
      `${pkg.platform}/${pkg.name} downstream dependents: ${pkg.dependents.toLocaleString()}`,
    );
    metadata.librariesIoDependents = pkg.dependents;
    metadata.librariesIoPackage = `${pkg.platform}/${pkg.name}`;
  }

  if (research?.isResearchRepo) {
    facts.push(`OpenAlex research signal: ${research.workCount} works · ${research.totalCitations} citations`);
    metadata.openAlexCitations = research.totalCitations;
    metadata.openAlexWorks = research.workCount;
    if (research.topWorks[0]) {
      facts.push(`Top cited: "${research.topWorks[0].title.slice(0, 80)}" (${research.topWorks[0].cited_by_count})`);
    }
  }

  if (!facts.length) return;

  const evidence: WorkerEvidence = {
    id: evidenceId("ecosystem", repoSubjectId(`${owner}/${repo}`)),
    worker: "EcosystemWorker",
    kind: "impact",
    subjectId: repoSubjectId(`${owner}/${repo}`),
    confidence: lib || research?.isResearchRepo ? 0.9 : 0.6,
    facts,
    metadata,
    producedAt: new Date().toISOString(),
  };
  bus.publish(evidence);
}
