import { createPublicClient, formatUnits, http } from "viem";
import { arcTestnet } from "@/lib/arc/config";

const ARC_ALCHEMY_BASE =
  process.env.ALCHEMY_ARC_RPC_URL?.trim() ||
  (process.env.ALCHEMY_API_KEY?.trim()
    ? `https://arc-testnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY.trim()}`
    : null);

const ARC_RPC_TIMEOUT_MS = 8_000;

const arcPublicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(undefined, { timeout: ARC_RPC_TIMEOUT_MS }),
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

async function getArcUsdcBalanceViaPublicRpc(address: string) {
  const wei = await arcPublicClient.getBalance({
    address: address as `0x${string}`,
  });
  return parseNativeUsdcBalance(`0x${wei.toString(16)}`);
}

/** Native USDC balance on Arc testnet (18-decimal wei). Alchemy first, public RPC fallback. */
export async function getArcUsdcBalance(address: string): Promise<{
  balanceUsd: number;
  balanceWei: string;
}> {
  if (ARC_ALCHEMY_BASE) {
    try {
      const hex = await alchemyRpc<string>("eth_getBalance", [address, "latest"]);
      return parseNativeUsdcBalance(hex);
    } catch {
      /* fall through to public RPC */
    }
  }
  return getArcUsdcBalanceViaPublicRpc(address);
}

export async function getArcTransactionCount(address: string): Promise<number> {
  const hex = await alchemyRpc<string>("eth_getTransactionCount", [address, "latest"]);
  return Number(BigInt(hex));
}
