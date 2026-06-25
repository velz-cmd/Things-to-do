import { createHash } from "crypto";
import { sendUsdcWithMemo } from "@/lib/arc/memo";
import { explorerTxUrl, isLiveArcEnabled } from "@/lib/settlement/arc-config";
import { buildContributorMemo } from "@/lib/payment/memo";
import type { MissionSettlementInput, PaymentIntent, SettlementProof } from "@/lib/payment/types";

export interface BatchExecuteResult {
  intents: PaymentIntent[];
  failedWallets: string[];
  txHashes: string[];
  memoIds: string[];
  explorerUrls: string[];
  proof: SettlementProof;
}

/**
 * Arc Batch Settlement — one memo transfer per contributor wallet.
 * Failed wallets are marked; others continue (no silent partial failure).
 */
export async function executeContributorBatch(input: {
  settlementId: string;
  missionId: string;
  repo?: string;
  proofHash: string;
  batchNumber: number;
  confidence: number;
  treasuryAmount: number;
  intents: PaymentIntent[];
}): Promise<BatchExecuteResult> {
  const updated: PaymentIntent[] = [];
  const failedWallets: string[] = [];
  const txHashes: string[] = [];
  const memoIds: string[] = [];
  const explorerUrls: string[] = [];

  for (const intent of input.intents) {
    const memoText = buildContributorMemo({
      missionId: input.missionId,
      repo: input.repo,
      intent,
      proofHash: input.proofHash,
      batchNumber: input.batchNumber,
    });

    const next: PaymentIntent = { ...intent, memoText, status: "processing" };

    if (!isLiveArcEnabled()) {
      updated.push({
        ...next,
        status: "settled",
        txHash: `offchain-${intent.wallet.slice(0, 10)}`,
        memoId: createHash("sha256").update(memoText).digest("hex").slice(0, 18),
      });
      continue;
    }

    try {
      const result = await sendUsdcWithMemo({
        recipient: intent.wallet as `0x${string}`,
        amountUsd: intent.amountUsd,
        memo: memoText,
        memoRef: `settle:${input.settlementId}:${intent.wallet.toLowerCase()}`,
      });
      next.status = "settled";
      next.txHash = result.txHash;
      next.memoId = result.memoId;
      txHashes.push(result.txHash);
      memoIds.push(result.memoId);
      explorerUrls.push(explorerTxUrl(result.txHash));
    } catch (e) {
      console.error(`[batch-settle] failed ${intent.wallet}:`, e);
      next.status = "failed";
      failedWallets.push(intent.wallet);
    }

    updated.push(next);
  }

  const auditHash = createHash("sha256")
    .update(JSON.stringify({ settlementId: input.settlementId, txHashes, proofHash: input.proofHash }))
    .digest("hex");

  const proof: SettlementProof = {
    settlementId: input.settlementId,
    missionId: input.missionId,
    proofHash: input.proofHash,
    batchNumber: input.batchNumber,
    txHashes,
    memoIds,
    timestamp: new Date().toISOString(),
    treasuryAmount: input.treasuryAmount,
    contributorCount: input.intents.length,
    confidence: input.confidence,
    auditHash,
  };

  return {
    intents: updated,
    failedWallets,
    txHashes,
    memoIds,
    explorerUrls,
    proof,
  };
}
