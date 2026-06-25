import { createHash } from "crypto";
import type { EvidenceBus } from "@/lib/evidence/bus";
import type { ProofBundle, ReasoningVerdict } from "@/lib/evidence/types";

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
export async function verifySettlementOnChain(txHash: string): Promise<{
  verified: boolean;
  explorerUrl?: string;
  message: string;
}> {
  const base = process.env.BLOCKSCOUT_API_URL ?? "https://testnet.arcscan.app/api";
  try {
    const res = await fetch(`${base}?module=transaction&action=gettxreceiptstatus&txhash=${txHash}`);
    if (!res.ok) {
      return { verified: false, message: "Blockscout unavailable — verify manually" };
    }
    const json = (await res.json()) as { result?: { status?: string } };
    const ok = json.result?.status === "1";
    return {
      verified: ok,
      explorerUrl: `https://testnet.arcscan.app/tx/${txHash}`,
      message: ok ? "Settlement confirmed on Arc" : "Transaction not confirmed",
    };
  } catch {
    return { verified: false, message: "Blockscout check skipped" };
  }
}
