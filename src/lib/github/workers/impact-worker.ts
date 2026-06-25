import { githubFetch } from "@/lib/github/client";
import type { EvidenceBus } from "@/lib/evidence/bus";
import { evidenceId } from "@/lib/evidence/bus";
import type { WorkerEvidence } from "@/lib/evidence/types";
import { prSubjectId } from "@/lib/evidence/normalizer";
import type { GitHubPullRequest } from "@/lib/github/types";

async function librariesIoDependents(packageName: string): Promise<number | null> {
  const key = process.env.LIBRARIES_IO_API_KEY;
  if (!key) return null;
  try {
    const data = await githubFetch<{ dependents_count?: number }>(
      `https://libraries.io/api/search?platform=GitHub&name=${encodeURIComponent(packageName)}&api_key=${key}`,
      { revalidate: 86400 },
    );
    return data?.dependents_count ?? null;
  } catch {
    return null;
  }
}

/** Worker 6 — Impact Worker. Reach and criticality via repo graph + optional Libraries.io. */
export async function runImpactWorker(
  bus: EvidenceBus,
  pr: GitHubPullRequest,
  repoContext: { stars: number; forks: number; fullName: string },
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

  const pkgJson = pr.files.find((f) => f.path.endsWith("package.json"));
  if (pkgJson) {
    const dependents = await librariesIoDependents(repoContext.fullName.split("/")[1] ?? "");
    if (dependents !== null) {
      facts.push(`Libraries.io dependents: ${dependents.toLocaleString()}`);
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
