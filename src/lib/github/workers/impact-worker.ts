import { fetchGithubProject } from "@/lib/integrations/libraries-io";
import type { EvidenceBus } from "@/lib/evidence/bus";
import { evidenceId } from "@/lib/evidence/bus";
import type { WorkerEvidence } from "@/lib/evidence/types";
import { prSubjectId } from "@/lib/evidence/normalizer";
import type { GitHubPullRequest } from "@/lib/github/types";

/** Worker 6 — Impact Worker. Reach via repo stars + Libraries.io downstream usage. */
export async function runImpactWorker(
  bus: EvidenceBus,
  pr: GitHubPullRequest,
  repoContext: { stars: number; forks: number; fullName: string; librariesDependents?: number },
): Promise<void> {
  const hasCore = pr.files.some((f) =>
    /src\/|lib\/|core\/|api\/|security|auth/i.test(f.path),
  );
  const perf = /perf|latency|memory|cache|optim/i.test(pr.title + pr.files.map((f) => f.path).join(" "));
  const security = /security|cve|vuln|auth/i.test(pr.title + pr.labels.join(" "));

  let impact = 35 + Math.log10(repoContext.stars + 1) * 12;
  if (hasCore) impact += 18;
  if (perf) impact += 15;
  if (security) impact += 20;
  impact = Math.min(100, Math.round(impact));

  const facts = [
    `Repository reach: ${repoContext.stars.toLocaleString()} stars`,
    hasCore ? "Touches core/security paths" : "Peripheral impact",
    perf ? "Performance improvement signal" : "No perf signal",
    security ? "Security-related change" : "Non-security change",
    `Impact estimate: ${impact}/100`,
  ];

  if (repoContext.librariesDependents != null && repoContext.librariesDependents > 0) {
    const boost = Math.min(25, Math.log10(repoContext.librariesDependents + 1) * 8);
    impact = Math.min(100, Math.round(impact + boost));
    facts.push(`Libraries.io downstream dependents: ${repoContext.librariesDependents.toLocaleString()}`);
  } else {
    const [owner, repo] = repoContext.fullName.split("/");
    if (owner && repo && pr.files.some((f) => f.path.endsWith("package.json"))) {
      const lib = await fetchGithubProject(owner, repo);
      const deps = lib?.dependents_count ?? lib?.dependent_repos_count;
      if (deps != null && deps > 0) {
        impact = Math.min(100, Math.round(impact + Math.min(20, Math.log10(deps + 1) * 6)));
        facts.push(`Libraries.io dependents: ${deps.toLocaleString()}`);
      }
    }
  }

  const evidence: WorkerEvidence = {
    id: evidenceId("impact", prSubjectId(pr.number)),
    worker: "ImpactWorker",
    kind: "impact",
    subjectId: prSubjectId(pr.number),
    confidence: repoContext.stars > 100 ? 0.88 : 0.72,
    facts,
    metadata: {
      impact,
      hasCore,
      perf,
      security,
      stars: repoContext.stars,
    },
    producedAt: new Date().toISOString(),
  };
  bus.publish(evidence);
}
