import { NextResponse } from "next/server";
import { resolveArcAlchemyRpcUrl } from "@/lib/wallet/arc-rpc-url";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const ALLOWED_METHODS = new Set([
  "eth_chainId",
  "eth_blockNumber",
  "eth_getBalance",
  "eth_call",
  "eth_getTransactionCount",
  "eth_getTransactionReceipt",
]);

/**
 * Server-safe JSON-RPC proxy for Arc testnet (Alchemy key stays on server).
 * Optional header: x-chain: arc-testnet (default).
 */
export async function POST(req: Request) {
  const chain = req.headers.get("x-chain")?.trim().toLowerCase() ?? "arc-testnet";
  if (chain !== "arc-testnet") {
    return NextResponse.json(
      { error: "Only arc-testnet is supported" },
      { status: 400 },
    );
  }

  const upstream = resolveArcAlchemyRpcUrl();
  if (!upstream) {
    return NextResponse.json(
      { error: "Alchemy Arc RPC not configured (set ALCHEMY_API_KEY or ALCHEMY_ARC_RPC_URL)" },
      { status: 503 },
    );
  }

  let body: { jsonrpc?: string; id?: unknown; method?: string; params?: unknown[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const method = body.method?.trim();
  if (!method || !ALLOWED_METHODS.has(method)) {
    return NextResponse.json({ error: `Method not allowed: ${method ?? "(missing)"}` }, { status: 400 });
  }

  try {
    const res = await fetch(upstream, {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: body.id ?? 1,
        method,
        params: body.params ?? [],
      }),
      signal: AbortSignal.timeout(12_000),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.ok ? 200 : 502 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "RPC proxy failed" },
      { status: 502 },
    );
  }
}
