import { createPublicClient, formatUnits, http } from "viem";
import { arcTestnet } from "@/lib/arc/config";

const client = createPublicClient({
  chain: arcTestnet,
  transport: http(),
});

/** Verify native USDC credited to the user's identity wallet (CCTP mint, faucet, transfer). */
export async function verifyArcDepositToWallet(params: {
  txHash: `0x${string}`;
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
      error: "USDC must be sent to your RESOLVE wallet address",
    };
  }

  const amountUsd = Number(formatUnits(tx.value, 18));
  if (amountUsd < 0.01) {
    return { ok: false as const, error: "Deposit amount too small" };
  }

  return { ok: true as const, amountUsd };
}
