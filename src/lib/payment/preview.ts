import type { GitHubAllocationResult } from "@/lib/github/types";
import { AGENT_NANO_RATES } from "@/lib/payment/types";
import { getContributorByGithub } from "@/lib/identity/contributors";

export interface PaymentPreviewContributor {
  login: string;
  weight: number;
  amountUsd: number;
  sharePercent: number;
  walletStatus: "ready" | "claimable";
  wallet?: string;
  rank: number;
}

export interface PaymentPreview {
  missionId: string;
  repo: string;
  treasuryUsd: number;
  readyToPayUsd: number;
  pendingClaimUsd: number;
  nanoAgentUsd: number;
  gasEstimateUsd: number;
  remainingTreasuryUsd: number;
  lockedUsd: number;
  reservedUsd: number;
  availableUsd: number;
  proofHash: string;
  confidence: number;
  contributors: PaymentPreviewContributor[];
  readyCount: number;
  pendingCount: number;
}

const DEFAULT_AGENTS = [
  "identity_worker",
  "repository_worker",
  "pr_worker",
  "code_worker",
  "collaboration_worker",
  "impact_worker",
  "reputation_worker",
  "ecosystem_worker",
  "reasoning_engine",
] as const;

function estimateGasUsd(readyCount: number): number {
  const perTx = 0.03;
  return Math.round((readyCount + DEFAULT_AGENTS.length) * perTx * 100) / 100;
}

function nanoTotal(agentsRun?: string[]): number {
  const agents = agentsRun?.length ? agentsRun : [...DEFAULT_AGENTS];
  return agents.reduce((s, a) => s + (AGENT_NANO_RATES[a] ?? 0.05), 0);
}

export async function buildPaymentPreview(input: {
  allocation: GitHubAllocationResult;
  missionId: string;
  confidence: number;
  agentsRun?: string[];
}): Promise<PaymentPreview> {
  const contributors: PaymentPreviewContributor[] = [];
  let readyToPayUsd = 0;
  let pendingClaimUsd = 0;

  const sorted = [...input.allocation.contributors].sort(
    (a, b) => b.payoutUsd - a.payoutUsd,
  );

  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i]!;
    const row = await getContributorByGithub(c.login);
    const wallet = row?.walletAddress;
    const hasWallet = Boolean(wallet?.match(/^0x[a-fA-F0-9]{40}$/));

    if (hasWallet) {
      readyToPayUsd += c.payoutUsd;
    } else {
      pendingClaimUsd += c.payoutUsd;
    }

    contributors.push({
      login: c.login,
      weight: c.totalWeight,
      amountUsd: c.payoutUsd,
      sharePercent: c.sharePercent,
      walletStatus: hasWallet ? "ready" : "claimable",
      wallet: hasWallet ? wallet! : undefined,
      rank: i + 1,
    });
  }

  const nanoAgentUsd = Math.round(nanoTotal(input.agentsRun) * 100) / 100;
  const gasEstimateUsd = estimateGasUsd(contributors.filter((c) => c.walletStatus === "ready").length);
  const lockedUsd = input.allocation.fundPoolUsd;
  const reservedUsd = pendingClaimUsd;
  const remainingTreasuryUsd =
    Math.round((lockedUsd - readyToPayUsd - nanoAgentUsd - gasEstimateUsd) * 100) / 100;

  return {
    missionId: input.missionId,
    repo: `${input.allocation.owner}/${input.allocation.repo}`,
    treasuryUsd: input.allocation.fundPoolUsd,
    readyToPayUsd: Math.round(readyToPayUsd * 100) / 100,
    pendingClaimUsd: Math.round(pendingClaimUsd * 100) / 100,
    nanoAgentUsd,
    gasEstimateUsd,
    remainingTreasuryUsd: Math.max(0, remainingTreasuryUsd),
    lockedUsd,
    reservedUsd,
    availableUsd: Math.max(0, remainingTreasuryUsd),
    proofHash: input.allocation.weightProofHash,
    confidence: input.confidence,
    contributors,
    readyCount: contributors.filter((c) => c.walletStatus === "ready").length,
    pendingCount: contributors.filter((c) => c.walletStatus === "claimable").length,
  };
}
