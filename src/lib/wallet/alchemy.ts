import { createPublicClient, http } from "viem";
import { arcTestnet } from "@/lib/arc/config";
import {
  ArcRpcUnavailableError,
  getArcUsdcBalance as readArcUsdcBalance,
  isAlchemyConfigured,
  getArcTransactionCount as readArcTxCount,
} from "@/lib/wallet/arc-usdc-balance";

export { ArcRpcUnavailableError, isAlchemyConfigured } from "@/lib/wallet/arc-usdc-balance";
export type { ArcUsdcBalance } from "@/lib/wallet/arc-usdc-balance";

const arcPublicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(
    process.env.ARC_RPC_URL?.trim() ||
      process.env.ARC_TESTNET_RPC_URL?.trim() ||
      "https://rpc.testnet.arc.network",
    { timeout: 8_000 },
  ),
});

/** @deprecated prefer getArcUsdcBalance from arc-usdc-balance — kept for legacy callers */
export async function getArcUsdcBalance(address: string): Promise<{
  balanceUsd: number;
  balanceWei: string;
  nativeUsd: number;
  erc20Usd: number;
}> {
  const bal = await readArcUsdcBalance(address);
  const nativeUsd = Number(bal.nativeUsdc);
  const erc20Usd = Number(bal.erc20Usdc);
  return {
    balanceUsd: Number(bal.totalUsdc),
    balanceWei: "0x0",
    nativeUsd,
    erc20Usd,
  };
}

export { readArcUsdcBalance as getArcUsdcBalanceDetailed };
export { readArcTxCount as getArcTransactionCount };
