import { NextResponse } from "next/server";
import {
  allArcRpcUrls,
} from "@/lib/wallet/arc-rpc-url";

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

function rpcUpstreamUrls(): string[] {
  return allArcRpcUrls();
}

/**
 * Server-safe JSON-RPC proxy for Arc testnet (Alchemy key stays on server when set).
 * Falls back to public Arc RPC when Alchemy is not configured.
 */
export async function POST(req: Request) {
  const chain = req.headers.get("x-chain")?.trim().toLowerCase() ?? "arc-testnet";
  if (chain !== "arc-testnet") {
    return NextResponse.json(
      { error: "Only arc-testnet is supported" },
      { status: 400 },
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

  const payload = JSON.stringify({
    jsonrpc: "2.0",
    id: body.id ?? 1,
    method,
    params: body.params ?? [],
  });

  let lastError: string | null = null;
  for (const upstream of rpcUpstreamUrls()) {
    try {
      const res = await fetch(upstream, {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: payload,
        signal: AbortSignal.timeout(12_000),
      });

      const data = await res.json();
      if (res.ok && !data.error) {
        return NextResponse.json(data, { status: 200 });
      }
      lastError = data.error?.message ?? `HTTP ${res.status}`;
    } catch (e) {
      lastError = e instanceof Error ? e.message : "RPC proxy failed";
    }
  }

  return NextResponse.json(
    { error: lastError ?? "All Arc RPC endpoints failed" },
    { status: 502 },
  );
}
