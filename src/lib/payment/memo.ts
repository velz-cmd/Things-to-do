import type { MissionSettlementInput, PaymentIntent } from "@/lib/payment/types";

export interface StructuredMemo {
  mission: string;
  repo?: string;
  contributor?: string;
  weight?: number;
  proof: string;
  settlement: string;
  batch: number;
  role: "contributor" | "agent" | "maintainer";
  rank?: number;
}

/** Arc Memo payload — searchable on-chain context */
export function buildContributorMemo(input: {
  missionId: string;
  repo?: string;
  intent: PaymentIntent;
  proofHash: string;
  batchNumber: number;
}): string {
  const structured: StructuredMemo = {
    mission: input.missionId,
    repo: input.repo,
    contributor: input.intent.login ?? input.intent.wallet.slice(0, 10),
    weight: Math.round(input.intent.weight * 100) / 100,
    proof: input.proofHash.slice(0, 18),
    settlement: `Batch-${input.batchNumber}`,
    batch: input.batchNumber,
    role: "contributor",
    rank: input.intent.rank,
  };

  const short = `MISSION:${input.missionId}|@${structured.contributor}|W:${structured.weight}|PROOF:${structured.proof}|BATCH:${input.batchNumber}`;
  return JSON.stringify({ ...structured, short });
}

export function buildAgentNanoMemo(input: {
  missionId: string;
  agentRole: string;
  proofHash: string;
  batchNumber: number;
}): string {
  const structured: StructuredMemo = {
    mission: input.missionId,
    proof: input.proofHash.slice(0, 18),
    settlement: `Batch-${input.batchNumber}`,
    batch: input.batchNumber,
    role: "agent",
  };

  return JSON.stringify({
    ...structured,
    agent: input.agentRole,
    short: `AGENT:${input.agentRole}|MISSION:${input.missionId}|BATCH:${input.batchNumber}`,
  });
}

export function memoPrefixForMission(pkg: MissionSettlementInput): string {
  return pkg.repo ? `${pkg.repo}` : pkg.missionId;
}
