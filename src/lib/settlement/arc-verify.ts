import { createPublicClient, http, isHash } from "viem";
import { arcTestnet } from "@/lib/arc/config";
import {
  ARC_CHAIN_ID,
  ARC_EXPLORER_URL,
  ARC_RPC_URL,
  explorerTxUrl,
} from "@/lib/settlement/arc-config";
import type { ArcTxVerification } from "@/lib/settlement/settlement-types";

const arcClient = createPublicClient({
  chain: arcTestnet,
  transport: http(ARC_RPC_URL),
});

export async function verifyArcTx(
  txHash: string
): Promise<ArcTxVerification> {
  if (!isHash(txHash)) {
    return {
      txHash,
      found: false,
      success: false,
      status: "failed",
      error: "Invalid transaction hash format",
    };
  }

  try {
    const receipt = await arcClient.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });

    if (!receipt) {
      return {
        txHash,
        found: false,
        success: false,
        status: "not_submitted",
        error: "Transaction not found on Arc RPC",
      };
    }

    const success = receipt.status === "success";
    const explorerUrl = explorerTxUrl(txHash);

    return {
      txHash,
      found: true,
      success,
      status: success ? "rpc_confirmed" : "failed",
      blockNumber: receipt.blockNumber.toString(),
      explorerUrl,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "RPC error";
    const pending =
      msg.toLowerCase().includes("not found") ||
      msg.toLowerCase().includes("could not be found");

    return {
      txHash,
      found: false,
      success: false,
      status: pending ? "not_submitted" : "failed",
      error: pending
        ? "Pending / not indexed on Arc yet"
        : msg,
    };
  }
}

export async function assertVerifiedTx(txHash: string) {
  const v = await verifyArcTx(txHash);
  if (!v.found || !v.success) {
    throw new Error(v.error ?? "Transaction not verified on Arc");
  }
  return v;
}

export function chainIdLabel() {
  return ARC_CHAIN_ID;
}

export function explorerBaseUrl() {
  return ARC_EXPLORER_URL;
}
