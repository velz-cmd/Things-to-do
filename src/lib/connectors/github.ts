import type { GitHubAllocationResult } from "@/lib/github/types";
import type { SettlementInputEvent } from "@/lib/authorization/types";

export function githubMissionId(allocation: GitHubAllocationResult): string {
  const stamp = allocation.evaluatedAt.replace(/[^0-9]/g, "").slice(0, 14);
  return `github-${allocation.owner}-${allocation.repo}-${stamp}`;
}

/** GitHub Distribution Connector → normalized SettlementInputEvents */
export function githubAllocationToSettlementInputs(
  allocation: GitHubAllocationResult,
): SettlementInputEvent[] {
  const missionId = githubMissionId(allocation);
  const contextLabel = `${allocation.owner}/${allocation.repo}`;
  const confidences = allocation.contributors.flatMap((c) =>
    c.verdicts.map((v) => v.confidence),
  );
  const confidence =
    confidences.length ?
      confidences.reduce((a, b) => a + b, 0) / confidences.length
    : 0.85;

  return allocation.contributors.map((c) => ({
    connectorId: "github",
    eventType: "contribution.weighted",
    occurredAt: allocation.evaluatedAt,
    missionId,
    idempotencyKey: `github:${missionId}:${c.login.toLowerCase()}`,
    payeeKeyType: "github_username",
    payeeKey: c.login.toLowerCase(),
    amountUsd: c.payoutUsd,
    weight: c.totalWeight,
    proofHash: allocation.weightProofHash,
    confidence,
    contextLabel,
    evidenceRefs: c.topEvidence.length ?
      c.topEvidence
    : c.verdicts.map((v) => `pr-${v.prNumber}`),
    rawMetadata: { sharePercent: c.sharePercent, trustScore: c.trustScore },
  }));
}
