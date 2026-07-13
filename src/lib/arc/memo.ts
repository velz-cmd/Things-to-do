import { createHash } from "crypto";
import {
  encodeFunctionData,
  erc20Abi,
  getAddress,
  keccak256,
  parseUnits,
  stringToHex,
  type Address,
} from "viem";
import { ARC_CLIENT_WALLET_ADDRESS, ARC_USDC_CONTRACT } from "@/lib/settlement/arc-config";
import { executeCircleContractOn } from "@/lib/settlement/circle-client";
import { ARC_MEMO_CONTRACT, MEMO_ABI } from "./memo-abi";
import { requireArcFeature } from "@/lib/arc/feature-flags";

export type MemoPayoutInput = {
  recipient: Address;
  amountUsd: number;
  /** Human-readable memo, e.g. batch id or mission ref */
  memo: string;
  /** Stable lookup id — batch:event or mission id */
  memoRef: string;
};

export type MemoPayoutResult = {
  txHash: string;
  memoId: `0x${string}`;
  memo: string;
  recipient: Address;
  amountUsd: number;
};

export function buildMemoId(ref: string): `0x${string}` {
  return keccak256(stringToHex(ref));
}

/** Send USDC via Arc Memo contract — attaches payout context onchain. */
export async function sendUsdcWithMemo(
  input: MemoPayoutInput,
): Promise<MemoPayoutResult> {
  requireArcFeature("memo");
  if (!ARC_CLIENT_WALLET_ADDRESS) {
    throw new Error("ARC_CLIENT_WALLET_ADDRESS not configured");
  }

  const recipient = getAddress(input.recipient);
  const transferData = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [recipient, parseUnits(input.amountUsd.toFixed(6), 6)],
  });

  const memoId = buildMemoId(input.memoRef);
  const memoBytes = stringToHex(input.memo.slice(0, 512));
  const memoText = input.memo;

  const txHash = await executeCircleContractOn({
    walletAddress: ARC_CLIENT_WALLET_ADDRESS,
    contractAddress: ARC_MEMO_CONTRACT,
    abiFunctionSignature: "memo(address,bytes,bytes32,bytes)",
    abiParameters: [
      ARC_USDC_CONTRACT,
      transferData,
      memoId,
      memoBytes,
    ],
    label: `memo payout ${input.memoRef}`,
    idempotencyKey: `memo:${input.memoRef}`,
  });

  return {
    txHash,
    memoId,
    memo: memoText,
    recipient,
    amountUsd: input.amountUsd,
  };
}

/** Aggregate batch payouts — one memo transfer per unique payee wallet. */
export async function sendBatchMemoPayouts(input: {
  batchId: string;
  payouts: { wallet: string; amountUsd: number; payeeName?: string | null }[];
}): Promise<MemoPayoutResult[]> {
  const results: MemoPayoutResult[] = [];
  for (const p of input.payouts) {
    if (p.amountUsd <= 0) continue;
    const memoRef = `resolve:batch:${input.batchId}:${p.wallet.toLowerCase()}`;
    const memo = JSON.stringify({
      batchId: input.batchId,
      payee: p.payeeName ?? null,
      wallet: p.wallet,
      amountUsd: p.amountUsd,
      type: "distribution",
    });
    const result = await sendUsdcWithMemo({
      recipient: p.wallet as Address,
      amountUsd: p.amountUsd,
      memo,
      memoRef,
    });
    results.push(result);
  }
  return results;
}

export function primaryTxFromPayouts(payouts: MemoPayoutResult[]): string | null {
  return payouts[0]?.txHash ?? null;
}

export function memoAuditHash(batchId: string, payouts: MemoPayoutResult[]): string {
  return createHash("sha256")
    .update(JSON.stringify({ batchId, payouts: payouts.map((p) => p.txHash) }))
    .digest("hex");
}
