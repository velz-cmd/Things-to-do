import { createPublicClient, formatUnits, http } from "viem";
import { arcTestnet } from "@/lib/arc/config";
import { resolveArcRpcUrl } from "@/lib/wallet/arc-rpc-url";

function arcReadClient() {
  return createPublicClient({
    chain: arcTestnet,
    transport: http(resolveArcRpcUrl()),
  });
}

/** Verify native USDC sent to the user's Circle identity wallet on Arc. */
export async function verifyArcIdentityDeposit(params: {
  txHash: `0x${string}`;
  expectedUsd: number;
  depositAddress: string;
}) {
  const receipt = await arcReadClient().getTransactionReceipt({ hash: params.txHash });
  if (receipt.status !== "success") {
    return { ok: false as const, error: "Transaction failed on-chain" };
  }

  const tx = await arcReadClient().getTransaction({ hash: params.txHash });
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

/** Verify native USDC transfer from a linked external wallet to the expected destination. */
export async function verifyArcTransferFromWallet(params: {
  txHash: `0x${string}`;
  expectedUsd: number;
  depositAddress: string;
  fromWallet: string;
  destinationLabel?: string;
}) {
  const receipt = await arcReadClient().getTransactionReceipt({ hash: params.txHash });
  if (receipt.status !== "success") {
    return { ok: false as const, error: "Transaction failed on-chain" };
  }

  const tx = await arcReadClient().getTransaction({ hash: params.txHash });
  if (!tx.to) {
    return { ok: false as const, error: "Invalid transaction" };
  }

  if (tx.to.toLowerCase() !== params.depositAddress.toLowerCase()) {
    const dest = params.destinationLabel ?? "the expected Arc address";
    return {
      ok: false as const,
      error: `Send USDC to ${dest}, not your RESOLVE identity wallet`,
    };
  }

  if (tx.from.toLowerCase() !== params.fromWallet.toLowerCase()) {
    return {
      ok: false as const,
      error: "Transaction must be signed by your connected wallet",
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
  const receipt = await arcReadClient().getTransactionReceipt({ hash: params.txHash });
  if (receipt.status !== "success") {
    return { ok: false as const, error: "Transaction failed on-chain" };
  }

  const tx = await arcReadClient().getTransaction({ hash: params.txHash });
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
