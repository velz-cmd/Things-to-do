import { createPublicClient, erc20Abi, formatUnits, http } from "viem";
import { arcTestnet } from "@/lib/arc/config";
import { ARC_CHAIN_ID, ARC_USDC_CONTRACT } from "@/lib/settlement/arc-config";

const ARC_ALCHEMY_BASE =
  process.env.ALCHEMY_ARC_RPC_URL?.trim() ||
  (process.env.ALCHEMY_API_KEY?.trim()
    ? `https://arc-testnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY.trim()}`
    : null);

const ARC_RPC_TIMEOUT_MS = 8_000;

const arcPublicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(
    process.env.ARC_RPC_URL?.trim() ||
      process.env.ARC_TESTNET_RPC_URL?.trim() ||
      "https://rpc.testnet.arc.network",
    { timeout: ARC_RPC_TIMEOUT_MS },
  ),
});

export type ArcUsdcBalance = {
  address: string;
  chainId: typeof ARC_CHAIN_ID;
  nativeUsdc: string;
  erc20Usdc: string;
  totalUsdc: string;
  blockNumber: number;
  source: "arc_rpc";
  syncedAt: string;
};

export class ArcRpcUnavailableError extends Error {
  code = "ARC_RPC_UNAVAILABLE" as const;
  constructor(message = "Could not sync Arc balance. Try again.") {
    super(message);
    this.name = "ArcRpcUnavailableError";
  }
}

async function alchemyRpc<T>(method: string, params: unknown[]): Promise<T> {
  if (!ARC_ALCHEMY_BASE) throw new ArcRpcUnavailableError("Alchemy Arc RPC not configured");

  const res = await fetch(ARC_ALCHEMY_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(ARC_RPC_TIMEOUT_MS),
  });

  if (!res.ok) throw new ArcRpcUnavailableError(`Arc RPC HTTP ${res.status}`);

  const data = (await res.json()) as { result?: T; error?: { message: string } };
  if (data.error) throw new ArcRpcUnavailableError(data.error.message);
  return data.result as T;
}

function formatUsd(amount: number): string {
  return (Math.round(amount * 100) / 100).toFixed(2);
}

async function readNativeUsdc(address: string): Promise<number> {
  if (ARC_ALCHEMY_BASE) {
    try {
      const hex = await alchemyRpc<string>("eth_getBalance", [address, "latest"]);
      return Number(formatUnits(BigInt(hex), 18));
    } catch {
      /* fall through to public RPC */
    }
  }

  const wei = await arcPublicClient.getBalance({
    address: address as `0x${string}`,
  });
  return Number(formatUnits(wei, 18));
}

async function readErc20Usdc(address: string): Promise<number> {
  const wei = await arcPublicClient.readContract({
    address: ARC_USDC_CONTRACT,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address as `0x${string}`],
  });
  return Number(formatUnits(wei, 6));
}

async function readBlockNumber(): Promise<number> {
  if (ARC_ALCHEMY_BASE) {
    try {
      const hex = await alchemyRpc<string>("eth_blockNumber", []);
      return Number(BigInt(hex));
    } catch {
      /* fall through */
    }
  }
  const block = await arcPublicClient.getBlockNumber();
  return Number(block);
}

/**
 * Read Arc testnet USDC from RPC — native (18 dec) + ERC-20 (6 dec).
 * Throws ArcRpcUnavailableError on failure — never returns fake zero.
 */
export async function getArcUsdcBalance(address: string): Promise<ArcUsdcBalance> {
  const normalized = address.trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(normalized)) {
    throw new ArcRpcUnavailableError("Invalid wallet address");
  }

  try {
    const [nativeUsd, erc20Usd, blockNumber] = await Promise.all([
      readNativeUsdc(normalized),
      readErc20Usdc(normalized),
      readBlockNumber(),
    ]);

    // Faucet may credit native or ERC-20; use max to avoid double-counting mirrored balances.
    const totalUsd = Math.max(nativeUsd, erc20Usd);

    return {
      address: normalized,
      chainId: ARC_CHAIN_ID as 5042002,
      nativeUsdc: formatUsd(nativeUsd),
      erc20Usdc: formatUsd(erc20Usd),
      totalUsdc: formatUsd(totalUsd),
      blockNumber,
      source: "arc_rpc",
      syncedAt: new Date().toISOString(),
    };
  } catch (e) {
    if (e instanceof ArcRpcUnavailableError) throw e;
    throw new ArcRpcUnavailableError(
      e instanceof Error ? e.message : "Arc RPC request failed",
    );
  }
}

export function isAlchemyConfigured(): boolean {
  return Boolean(ARC_ALCHEMY_BASE);
}

export async function getArcTransactionCount(address: string): Promise<number> {
  if (ARC_ALCHEMY_BASE) {
    try {
      const hex = await alchemyRpc<string>("eth_getTransactionCount", [address, "latest"]);
      return Number(BigInt(hex));
    } catch {
      /* fall through */
    }
  }
  const hex = await arcPublicClient.getTransactionCount({
    address: address as `0x${string}`,
  });
  return Number(hex);
}
