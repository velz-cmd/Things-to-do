import { createHash } from "crypto";
import type { EvidenceBus } from "@/lib/evidence/bus";
import type { ProofBundle, ReasoningVerdict } from "@/lib/evidence/types";
import { verifyTransaction } from "@/lib/integrations/blockscout";

export function buildProofBundle(input: {
  bus: EvidenceBus;
  verdicts: ReasoningVerdict[];
  allocationPayload: Record<string, unknown>;
}): ProofBundle {
  const evidenceHash = input.bus.hash();
  const reasoningHash = createHash("sha256")
    .update(JSON.stringify(input.verdicts.map((v) => ({ pr: v.prNumber, weight: v.valueWeight, tier: v.confidence.tier }))))
    .digest("hex");
  const verdictHash = createHash("sha256")
    .update(JSON.stringify(input.verdicts))
    .digest("hex");
  const settlementHash = createHash("sha256")
    .update(JSON.stringify(input.allocationPayload))
    .digest("hex");
  const proofRoot = createHash("sha256")
    .update(`${evidenceHash}:${reasoningHash}:${verdictHash}:${settlementHash}`)
    .digest("hex");

  return { evidenceHash, reasoningHash, verdictHash, settlementHash, proofRoot };
}

/** Blockscout verification — post-settlement only, never used for scoring. */
export async function verifySettlementOnChain(txHash: string) {
  return verifyTransaction(txHash);
}
