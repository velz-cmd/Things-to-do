import { formatUnits } from "viem";

const ARC_ALCHEMY_BASE =
  process.env.ALCHEMY_ARC_RPC_URL?.trim() ||
  (process.env.ALCHEMY_API_KEY?.trim()
    ? `https://arc-testnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY.trim()}`
    : null);

export function isAlchemyConfigured(): boolean {
  return Boolean(ARC_ALCHEMY_BASE);
}

async function alchemyRpc<T>(method: string, params: unknown[]): Promise<T> {
  if (!ARC_ALCHEMY_BASE) throw new Error("ALCHEMY_API_KEY not configured");

  const res = await fetch(ARC_ALCHEMY_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });

  if (!res.ok) {
    throw new Error(`Alchemy HTTP ${res.status}`);
  }

  const data = (await res.json()) as { result?: T; error?: { message: string } };
  if (data.error) throw new Error(data.error.message);
  return data.result as T;
}

/** Native USDC balance on Arc testnet via Alchemy (18-decimal wei → 6-decimal USDC). */
export async function getArcUsdcBalance(address: string): Promise<{
  balanceUsd: number;
  balanceWei: string;
}> {
  const hex = await alchemyRpc<string>("eth_getBalance", [address, "latest"]);
  const wei = BigInt(hex);
  const balanceUsd = Number(formatUnits(wei, 18));
  return { balanceUsd, balanceWei: hex };
}

export async function getArcTransactionCount(address: string): Promise<number> {
  const hex = await alchemyRpc<string>("eth_getTransactionCount", [address, "latest"]);
  return Number(BigInt(hex));
}
