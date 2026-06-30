import { createPublicClient, erc20Abi, formatUnits, http } from "viem";
import { arcTestnet } from "@/lib/arc/config";
import { ARC_USDC_CONTRACT } from "@/lib/settlement/arc-config";

const ARC_ALCHEMY_BASE =
  process.env.ALCHEMY_ARC_RPC_URL?.trim() ||
  (process.env.ALCHEMY_API_KEY?.trim()
    ? `https://arc-testnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY.trim()}`
    : null);

const ARC_RPC_TIMEOUT_MS = 6_000;

const arcPublicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(
    process.env.ARC_RPC_URL?.trim() ||
      process.env.ARC_TESTNET_RPC_URL?.trim() ||
      "https://rpc.testnet.arc.network",
    { timeout: ARC_RPC_TIMEOUT_MS },
  ),
});

export function isAlchemyConfigured(): boolean {
  return Boolean(ARC_ALCHEMY_BASE);
}

async function alchemyRpc<T>(method: string, params: unknown[]): Promise<T> {
  if (!ARC_ALCHEMY_BASE) throw new Error("ALCHEMY_API_KEY not configured");

  const res = await fetch(ARC_ALCHEMY_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(ARC_RPC_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`Alchemy HTTP ${res.status}`);
  }

  const data = (await res.json()) as { result?: T; error?: { message: string } };
  if (data.error) throw new Error(data.error.message);
  return data.result as T;
}

function parseNativeUsdcBalance(hex: string) {
  const wei = BigInt(hex);
  const balanceUsd = Number(formatUnits(wei, 18));
  return { balanceUsd, balanceWei: hex };
}

async function getNativeBalance(address: string): Promise<number> {
  try {
    if (ARC_ALCHEMY_BASE) {
      try {
        const hex = await alchemyRpc<string>("eth_getBalance", [address, "latest"]);
        return parseNativeUsdcBalance(hex).balanceUsd;
      } catch {
        /* fall through */
      }
    }
    const wei = await arcPublicClient.getBalance({
      address: address as `0x${string}`,
    });
    return parseNativeUsdcBalance(`0x${wei.toString(16)}`).balanceUsd;
  } catch {
    return 0;
  }
}

/** Circle faucet / bridge may credit the USDC ERC20 contract (6 decimals). */
async function getErc20UsdcBalance(address: string): Promise<number> {
  try {
    const wei = await arcPublicClient.readContract({
      address: ARC_USDC_CONTRACT,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address as `0x${string}`],
    });
    return Number(formatUnits(wei, 6));
  } catch {
    return 0;
  }
}

/**
 * Total spendable USDC on Arc — max of native (18 dec gas USDC) and ERC20 contract balance.
 * Faucet deposits may land in either form.
 */
export async function getArcUsdcBalance(address: string): Promise<{
  balanceUsd: number;
  balanceWei: string;
  nativeUsd: number;
  erc20Usd: number;
}> {
  const [nativeUsd, erc20Usd] = await Promise.all([
    getNativeBalance(address),
    getErc20UsdcBalance(address),
  ]);
  const balanceUsd = Math.max(nativeUsd, erc20Usd);
  return {
    balanceUsd,
    balanceWei: "0x0",
    nativeUsd,
    erc20Usd,
  };
}

export async function getArcTransactionCount(address: string): Promise<number> {
  if (!ARC_ALCHEMY_BASE) {
    const hex = await arcPublicClient.getTransactionCount({
      address: address as `0x${string}`,
    });
    return Number(hex);
  }
  const hex = await alchemyRpc<string>("eth_getTransactionCount", [address, "latest"]);
  return Number(BigInt(hex));
}
