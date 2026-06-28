import { randomUUID } from "crypto";
import { sendBatchMemoPayouts, sendUsdcWithMemo } from "@/lib/arc/memo";
import { buildContributorMemo } from "@/lib/payment/memo";
import { isLiveArcEnabled } from "@/lib/settlement/arc-config";

type ClaimItem = {
  id: string;
  source: "authorization" | "legacy_reward";
  amountUsd: number;
  missionId: string;
  contextLabel?: string | null;
  repo?: string | null;
  proofHash?: string | null;
};

export async function settleClaimBatch(input: {
  githubUsername: string;
  walletAddress: string;
  items: ClaimItem[];
}): Promise<{ txHash: string; batchId: string; memo: string } | { offchain: true; batchId: string }> {
  const batchId = `claim:${input.githubUsername}:${randomUUID()}`;
  const totalUsd = input.items.reduce((s, i) => s + i.amountUsd, 0);

  if (totalUsd <= 0) {
    return { offchain: true, batchId };
  }

  const memoPayload = {
    type: "claim_batch",
    batchId,
    github: input.githubUsername,
    wallet: input.walletAddress,
    totalUsd,
    items: input.items.map((i) => ({
      id: i.id,
      source: i.source,
      amountUsd: i.amountUsd,
      missionId: i.missionId,
    })),
  };
  const memo = JSON.stringify(memoPayload);

  if (!isLiveArcEnabled()) {
    return { offchain: true, batchId };
  }

  if (input.items.length === 1) {
    const item = input.items[0]!;
    const intent = {
      id: `claim:${item.id}`,
      wallet: input.walletAddress,
      login: input.githubUsername,
      weight: 0,
      amountUsd: item.amountUsd,
      rank: 0,
      status: "processing" as const,
    };
    const memoText = buildContributorMemo({
      missionId: item.missionId,
      repo: item.contextLabel ?? item.repo ?? undefined,
      intent,
      proofHash: item.proofHash ?? item.id,
      batchNumber: 0,
    });
    const result = await sendUsdcWithMemo({
      recipient: input.walletAddress as `0x${string}`,
      amountUsd: item.amountUsd,
      memo: memoText,
      memoRef: `${batchId}:${item.id}`,
    });
    return { txHash: result.txHash, batchId, memo: memoText };
  }

  const results = await sendBatchMemoPayouts({
    batchId,
    payouts: [
      {
        wallet: input.walletAddress,
        amountUsd: totalUsd,
        payeeName: input.githubUsername,
      },
    ],
  });

  const txHash = results[0]?.txHash;
  if (!txHash) {
    throw new Error("Arc batch claim settlement returned no transaction");
  }

  return { txHash, batchId, memo };
}
