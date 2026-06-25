import { EvidenceBus } from "@/lib/evidence/bus";
import { normalizeGithubIngest, artifactToPr } from "@/lib/evidence/normalizer";
import { ingestRepository } from "@/lib/github/adapter";
import { normalizeFounderIntent } from "@/lib/github/founder-intent";
import { computeRepoHealth } from "@/lib/github/repo-health";
import { reasonAllPrs } from "@/lib/github/reasoning-engine";
import { buildProofBundle } from "@/lib/github/proof-engine";
import {
  runIdentityWorker,
  runRepositoryWorker,
  runPrWorker,
  runCodeWorker,
  runCollaborationWorker,
  runImpactWorker,
  runReputationWorker,
} from "@/lib/github/workers";
import { runRepoEcosystemWorker } from "@/lib/github/workers/ecosystem-worker";
import { fetchPackageDependentsForRepo } from "@/lib/integrations/libraries-io";
import type {
  ContributorAllocation,
  GitHubAllocationResult,
  PRWeightVerdict,
  FounderIntent,
} from "@/lib/github/types";
import type { ReasoningVerdict } from "@/lib/evidence/types";

export interface PipelineResult {
  allocation: GitHubAllocationResult;
  busEvidenceCount: number;
  proof: ReturnType<typeof buildProofBundle>;
  verdicts: ReasoningVerdict[];
}

function verdictToLegacy(v: ReasoningVerdict): PRWeightVerdict {
  return {
    prNumber: v.prNumber ?? 0,
    author: v.author,
    category: v.category as PRWeightVerdict["category"],
    trustScore: Math.round(v.confidence.identity * 100),
    agents: [
      { agent: "code_impact", score: Math.round(v.confidence.contribution * 100), reasoning: v.reasoning[1] ?? "" },
      { agent: "project_impact", score: Math.round(v.confidence.contribution * 100), reasoning: v.reasoning[2] ?? "" },
      { agent: "economic_impact", score: Math.round(v.confidence.impact * 100), reasoning: v.reasoning[3] ?? "" },
    ],
    finalWeight: v.valueWeight,
    confidence: v.confidence.settlement,
    status: v.status === "verified" ? "verified" : v.status === "excluded" ? "sybil" : "manual_review",
    evidence: v.reasoning,
  };
}

/**
 * RESOLVE GitHub Pipeline — Cursor-style orchestration.
 * Collect → Normalize → Workers (parallel) → Reasoning (once) → Allocate → Proof
 */
export async function runGithubPipeline(input: {
  owner: string;
  repo: string;
  fundPoolUsd: number;
  evaluationDays?: number;
  founderIntent?: Partial<FounderIntent>;
  useLlm?: boolean;
}): Promise<PipelineResult | { error: string }> {
  const ingest = await ingestRepository(input.owner, input.repo, { prLimit: 25 });
  if (!ingest) {
    return { error: `Could not ingest ${input.owner}/${input.repo} — check repo name or GITHUB_TOKEN` };
  }

  const founderIntent = normalizeFounderIntent(input.founderIntent ?? {});
  const repoHealth = computeRepoHealth(ingest);
  const bus = new EvidenceBus();

  const cutoff = input.evaluationDays
    ? Date.now() - input.evaluationDays * 24 * 60 * 60 * 1000
    : 0;

  const eligiblePrs = ingest.pullRequests.filter((pr) => {
    if (!pr.mergedAt) return pr.merged;
    return new Date(pr.mergedAt).getTime() >= cutoff;
  });

  normalizeGithubIngest(ingest);

  runIdentityWorker(bus, ingest, eligiblePrs);
  runRepositoryWorker(bus, ingest);

  const [ownerName, repoName] = [input.owner, input.repo];
  const pkgDeps = await fetchPackageDependentsForRepo(ownerName, repoName);
  const librariesDependents = pkgDeps?.dependents;

  await runRepoEcosystemWorker(bus, ownerName, repoName, ingest.stars);

  for (const pr of eligiblePrs.slice(0, 20)) {
    runPrWorker(bus, pr);
    runCollaborationWorker(bus, pr);
    runReputationWorker(bus, pr, eligiblePrs);
  }

  const codeAndImpact = eligiblePrs.slice(0, 20).map(async (pr) => {
    if (input.useLlm === false) {
      const { runCodeWorker: run } = await import("@/lib/github/workers/code-worker");
      await run(bus, pr);
    } else {
      await runCodeWorker(bus, pr);
    }
    await runImpactWorker(bus, pr, {
      stars: ingest.stars,
      forks: ingest.forks,
      fullName: ingest.fullName,
      librariesDependents,
    });
  });
  await Promise.all(codeAndImpact);

  const verdicts = reasonAllPrs({ bus, prs: eligiblePrs.slice(0, 20), founderIntent });
  const settleable = verdicts.filter(
    (v) => v.status !== "excluded" && v.valueWeight > 0 && v.confidence.status !== "excluded",
  );

  const byAuthor = new Map<string, { verdicts: ReasoningVerdict[]; weight: number }>();
  for (const v of settleable) {
    const key = v.author.toLowerCase();
    const cur = byAuthor.get(key) ?? { verdicts: [], weight: 0 };
    cur.verdicts.push(v);
    cur.weight += v.valueWeight;
    byAuthor.set(key, cur);
  }

  const totalWeight = Array.from(byAuthor.values()).reduce((s, a) => s + a.weight, 0) || 1;

  const contributors: ContributorAllocation[] = Array.from(byAuthor.entries())
    .map(([login, data]) => {
      const contributor = ingest.contributors.find((c) => c.login.toLowerCase() === login);
      const sharePercent = Math.round((data.weight / totalWeight) * 1000) / 10;
      const payoutUsd = Math.round((data.weight / totalWeight) * input.fundPoolUsd * 100) / 100;
      const legacyVerdicts = data.verdicts.map(verdictToLegacy);

      return {
        login: contributor?.login ?? login,
        avatarUrl: contributor?.avatarUrl,
        trustScore: Math.round(data.verdicts[0]?.confidence.identity ?? 0.5 * 100),
        totalWeight: data.weight,
        sharePercent,
        payoutUsd,
        prCount: data.verdicts.length,
        topEvidence: legacyVerdicts.flatMap((v) => v.evidence).slice(0, 5),
        verdicts: legacyVerdicts,
      };
    })
    .sort((a, b) => b.totalWeight - a.totalWeight);

  const allocationPayload = {
    owner: input.owner,
    repo: input.repo,
    fundPoolUsd: input.fundPoolUsd,
    founderIntent,
    contributors: contributors.map((c) => ({
      login: c.login,
      totalWeight: c.totalWeight,
      sharePercent: c.sharePercent,
      payoutUsd: c.payoutUsd,
    })),
  };

  const proof = buildProofBundle({ bus, verdicts: settleable, allocationPayload });

  const allocation: GitHubAllocationResult = {
    owner: input.owner,
    repo: input.repo,
    fundPoolUsd: input.fundPoolUsd,
    evaluationDays: input.evaluationDays ?? 30,
    founderIntent,
    repoHealth,
    contributors,
    totalWeight,
    weightProofHash: proof.proofRoot,
    evaluatedAt: new Date().toISOString(),
    transparency: contributors.map((c) => ({
      login: c.login,
      score: c.totalWeight,
      evidence: c.topEvidence,
      payoutUsd: c.payoutUsd,
    })),
  };

  return {
    allocation,
    busEvidenceCount: bus.all().length,
    proof,
    verdicts: settleable,
  };
}
