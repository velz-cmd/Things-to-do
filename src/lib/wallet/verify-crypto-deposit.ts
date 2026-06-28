import { createPublicClient, formatUnits, http } from "viem";
import { arcTestnet } from "@/lib/arc/config";

const client = createPublicClient({
  chain: arcTestnet,
  transport: http(),
});

/** Verify native USDC sent to the user's Circle identity wallet on Arc. */
export async function verifyArcIdentityDeposit(params: {
  txHash: `0x${string}`;
  expectedUsd: number;
  depositAddress: string;
}) {
  const receipt = await client.getTransactionReceipt({ hash: params.txHash });
  if (receipt.status !== "success") {
    return { ok: false as const, error: "Transaction failed on-chain" };
  }

  const tx = await client.getTransaction({ hash: params.txHash });
  if (!tx.to) {
    return { ok: false as const, error: "Invalid transaction" };
  }

  if (tx.to.toLowerCase() !== params.depositAddress.toLowerCase()) {
    return {
      ok: false as const,
      error: "Send USDC to your Arc identity wallet address",
    };
  }

  const sentUsd = Number(formatUnits(tx.value, 18));
  if (sentUsd + 0.000001 < params.expectedUsd) {
    return {
      ok: false as const,
      error: `Expected at least $${params.expectedUsd.toFixed(2)} USDC`,
    };
  }

  return { ok: true as const, amountUsd: sentUsd };
}

/** @deprecated Legacy shared escrow — prefer verifyArcIdentityDeposit */
export async function verifyAgentEscrowDeposit(params: {
  txHash: `0x${string}`;
  expectedUsd: number;
  fromWallet: string;
}) {
  const { RESOLVE_AGENT_ESCROW_ADDRESS } = await import("@/lib/arc/config");
  const receipt = await client.getTransactionReceipt({ hash: params.txHash });
  if (receipt.status !== "success") {
    return { ok: false as const, error: "Transaction failed on-chain" };
  }

  const tx = await client.getTransaction({ hash: params.txHash });
  if (!tx.to) {
    return { ok: false as const, error: "Invalid transaction" };
  }

  if (tx.to.toLowerCase() !== RESOLVE_AGENT_ESCROW_ADDRESS.toLowerCase()) {
    return {
      ok: false as const,
      error: "Send USDC to your Arc identity wallet address",
    };
  }

  if (tx.from.toLowerCase() !== params.fromWallet.toLowerCase()) {
    return { ok: false as const, error: "Transaction must come from your linked wallet" };
  }

  const sentUsd = Number(formatUnits(tx.value, 18));
  if (sentUsd + 0.000001 < params.expectedUsd) {
    return {
      ok: false as const,
      error: `Expected at least $${params.expectedUsd.toFixed(2)} USDC`,
    };
  }

  return { ok: true as const, amountUsd: sentUsd };
}
