import { NextResponse } from "next/server";
import { getArcUsdcBalance, isAlchemyConfigured } from "@/lib/wallet/arc-usdc-balance";
import { resolveArcRpcUrl } from "@/lib/wallet/arc-rpc-url";

export const dynamic = "force-dynamic";

/** Ops check — confirms Arc RPC (Alchemy when configured) without exposing secrets. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const probe = url.searchParams.get("address")?.trim().toLowerCase();

  try {
    const blockRes = await fetch(resolveArcRpcUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }),
      signal: AbortSignal.timeout(10_000),
    });
    const blockJson = (await blockRes.json()) as { result?: string; error?: { message: string } };
    const blockNumber = blockJson.result ? Number(BigInt(blockJson.result)) : null;

    let balanceProbe: { address: string; totalUsdc: string } | null = null;
    if (probe && /^0x[a-f0-9]{40}$/.test(probe)) {
      const bal = await getArcUsdcBalance(probe);
      balanceProbe = { address: bal.address, totalUsdc: bal.totalUsdc };
    }

    return NextResponse.json({
      ok: blockNumber !== null,
      alchemyConfigured: isAlchemyConfigured(),
      primaryRpc: isAlchemyConfigured() ? "alchemy_arc_testnet" : "public_arc_testnet",
      blockNumber,
      balanceProbe,
      rpcError: blockJson.error?.message ?? null,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        alchemyConfigured: isAlchemyConfigured(),
        error: e instanceof Error ? e.message : "Arc RPC health check failed",
      },
      { status: 503 },
    );
  }
}
