import { createPublicClient, erc20Abi, formatUnits, http, type PublicClient } from "viem";
import { arcTestnet } from "@/lib/arc/config";
import { ARC_CHAIN_ID, ARC_USDC_CONTRACT } from "@/lib/settlement/arc-config";

const ARC_RPC_URLS = [
  process.env.ARC_RPC_URL?.trim(),
  process.env.ARC_TESTNET_RPC_URL?.trim(),
  "https://rpc.testnet.arc.network",
  "https://arc-testnet.drpc.org",
].filter((url): url is string => Boolean(url));

const ARC_ALCHEMY_BASE =
  process.env.ALCHEMY_ARC_RPC_URL?.trim() ||
  (process.env.ALCHEMY_API_KEY?.trim()
    ? `https://arc-testnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY.trim()}`
    : null);

const RPC_TIMEOUT_MS = 12_000;
const RPC_RETRIES = 2;

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

function formatUsd(amount: number): string {
  return (Math.round(amount * 100) / 100).toFixed(2);
}

function makeClient(rpcUrl: string): PublicClient {
  return createPublicClient({
    chain: arcTestnet,
    transport: http(rpcUrl, { timeout: RPC_TIMEOUT_MS }),
  });
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < RPC_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (attempt < RPC_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
      }
    }
  }
  throw new ArcRpcUnavailableError(
    lastError instanceof Error ? `${label}: ${lastError.message}` : label,
  );
}

async function alchemyRpc<T>(method: string, params: unknown[]): Promise<T> {
  if (!ARC_ALCHEMY_BASE) throw new ArcRpcUnavailableError("Alchemy not configured");

  const res = await fetch(ARC_ALCHEMY_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
  });

  if (!res.ok) throw new ArcRpcUnavailableError(`Alchemy HTTP ${res.status}`);

  const data = (await res.json()) as { result?: T; error?: { message: string } };
  if (data.error) throw new ArcRpcUnavailableError(data.error.message);
  return data.result as T;
}

async function readNativeUsdc(address: string): Promise<number> {
  if (ARC_ALCHEMY_BASE) {
    try {
      const hex = await alchemyRpc<string>("eth_getBalance", [address, "latest"]);
      return Number(formatUnits(BigInt(hex), 18));
    } catch {
      /* fall through to public RPCs */
    }
  }

  return withRetry(async () => {
    let lastErr: unknown;
    for (const rpcUrl of ARC_RPC_URLS) {
      try {
        const client = makeClient(rpcUrl);
        const wei = await client.getBalance({ address: address as `0x${string}` });
        return Number(formatUnits(wei, 18));
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr ?? new Error("All Arc RPC endpoints failed");
  }, "native balance");
}

async function readErc20Usdc(address: string): Promise<number> {
  return withRetry(async () => {
    let lastErr: unknown;
    for (const rpcUrl of ARC_RPC_URLS) {
      try {
        const client = makeClient(rpcUrl);
        const wei = await client.readContract({
          address: ARC_USDC_CONTRACT,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address as `0x${string}`],
        });
        return Number(formatUnits(wei, 6));
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr ?? new Error("ERC-20 balance read failed");
  }, "erc20 balance");
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

  for (const rpcUrl of ARC_RPC_URLS) {
    try {
      const client = makeClient(rpcUrl);
      const block = await client.getBlockNumber();
      return Number(block);
    } catch {
      /* try next */
    }
  }
  return 0;
}

/**
 * Read Arc testnet USDC from RPC — native (18 dec) + ERC-20 (6 dec).
 * Public Arc RPC first with retries; throws on total failure (never fake zero).
 */
export async function getArcUsdcBalance(address: string): Promise<ArcUsdcBalance> {
  const normalized = address.trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(normalized)) {
    throw new ArcRpcUnavailableError("Invalid wallet address");
  }

  try {
    const [nativeUsd, erc20Usd] = await Promise.all([
      readNativeUsdc(normalized),
      readErc20Usdc(normalized).catch(() => 0),
    ]);

    const blockNumber = await readBlockNumber().catch(() => 0);
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
  for (const rpcUrl of ARC_RPC_URLS) {
    try {
      const client = makeClient(rpcUrl);
      const hex = await client.getTransactionCount({
        address: address as `0x${string}`,
      });
      return Number(hex);
    } catch {
      /* try next */
    }
  }
  return 0;
}
