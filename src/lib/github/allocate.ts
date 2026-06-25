import { createHash } from "crypto";
import { ingestRepository } from "@/lib/github/adapter";
import { normalizeFounderIntent } from "@/lib/github/founder-intent";
import { computeRepoHealth } from "@/lib/github/repo-health";
import { computeTrustScores } from "@/lib/github/sybil-shield";
import { evaluatePrWeight } from "@/lib/github/weight-council";
import type {
  ContributorAllocation,
  FounderIntent,
  GitHubAllocationResult,
  PRWeightVerdict,
} from "@/lib/github/types";

export async function allocateGithubPool(input: {
  owner: string;
  repo: string;
  fundPoolUsd: number;
  evaluationDays?: number;
  founderIntent?: Partial<FounderIntent>;
  useLlm?: boolean;
}): Promise<GitHubAllocationResult | { error: string }> {
  const ingest = await ingestRepository(input.owner, input.repo, { prLimit: 25 });
  if (!ingest) {
    return { error: `Could not ingest ${input.owner}/${input.repo} — check repo name or GITHUB_TOKEN` };
  }

  const founderIntent = normalizeFounderIntent(input.founderIntent ?? {});
  const repoHealth = computeRepoHealth(ingest);
  const trustMap = computeTrustScores(ingest.contributors, ingest.pullRequests);

  const cutoff = input.evaluationDays
    ? Date.now() - input.evaluationDays * 24 * 60 * 60 * 1000
    : 0;

  const eligiblePrs = ingest.pullRequests.filter((pr) => {
    if (!pr.mergedAt) return true;
    return new Date(pr.mergedAt).getTime() >= cutoff;
  });

  const verdicts: PRWeightVerdict[] = [];
  for (const pr of eligiblePrs.slice(0, 20)) {
    const trust = trustMap.get(pr.author.toLowerCase()) ?? {
      login: pr.author,
      score: 40,
      confidence: 0.5,
      status: "low_trust" as const,
      signals: [],
    };
    const verdict = await evaluatePrWeight({
      pr,
      trust,
      stars: ingest.stars,
      founderIntent,
      useLlm: input.useLlm ?? true,
    });
    if (verdict.status !== "sybil" && verdict.finalWeight > 0) {
      verdicts.push(verdict);
    }
  }

  const byAuthor = new Map<string, { verdicts: PRWeightVerdict[]; weight: number }>();
  for (const v of verdicts) {
    const key = v.author.toLowerCase();
    const cur = byAuthor.get(key) ?? { verdicts: [], weight: 0 };
    cur.verdicts.push(v);
    cur.weight += v.finalWeight;
    byAuthor.set(key, cur);
  }

  const totalWeight = Array.from(byAuthor.values()).reduce((s, a) => s + a.weight, 0) || 1;

  const contributors: ContributorAllocation[] = Array.from(byAuthor.entries())
    .map(([login, data]) => {
      const contributor = ingest.contributors.find((c) => c.login.toLowerCase() === login);
      const trust = trustMap.get(login)?.score ?? 40;
      const sharePercent = Math.round((data.weight / totalWeight) * 1000) / 10;
      const payoutUsd = Math.round((data.weight / totalWeight) * input.fundPoolUsd * 100) / 100;
      const topEvidence = data.verdicts
        .sort((a, b) => b.finalWeight - a.finalWeight)
        .slice(0, 3)
        .flatMap((v) => v.evidence.slice(0, 2));

      return {
        login: contributor?.login ?? login,
        avatarUrl: contributor?.avatarUrl,
        trustScore: trust,
        totalWeight: data.weight,
        sharePercent,
        payoutUsd,
        prCount: data.verdicts.length,
        topEvidence,
        verdicts: data.verdicts,
      };
    })
    .sort((a, b) => b.totalWeight - a.totalWeight);

  const proofPayload = {
    owner: input.owner,
    repo: input.repo,
    fundPoolUsd: input.fundPoolUsd,
    founderIntent,
    contributors: contributors.map((c) => ({
      login: c.login,
      totalWeight: c.totalWeight,
      sharePercent: c.sharePercent,
      payoutUsd: c.payoutUsd,
      trustScore: c.trustScore,
    })),
    verdicts: verdicts.map((v) => ({
      pr: v.prNumber,
      weight: v.finalWeight,
      status: v.status,
    })),
  };

  const weightProofHash = createHash("sha256")
    .update(JSON.stringify(proofPayload))
    .digest("hex");

  return {
    owner: input.owner,
    repo: input.repo,
    fundPoolUsd: input.fundPoolUsd,
    evaluationDays: input.evaluationDays ?? 30,
    founderIntent,
    repoHealth,
    contributors,
    totalWeight,
    weightProofHash,
    evaluatedAt: new Date().toISOString(),
    transparency: contributors.map((c) => ({
      login: c.login,
      score: c.totalWeight,
      evidence: c.topEvidence,
      payoutUsd: c.payoutUsd,
    })),
  };
}
