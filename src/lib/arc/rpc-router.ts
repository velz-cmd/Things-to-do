import "server-only";

import { allArcRpcUrls } from "@/lib/wallet/arc-rpc-url";
import {
  runWithFallbackResult,
  type ProviderFallbackResult,
} from "@/lib/providers/provider-router";

type JsonRpcResponse<T> = {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
};

async function callRpc<T>(url: string, method: string, params: readonly unknown[]): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`rpc_http_${response.status}`);
  const body = await response.json() as JsonRpcResponse<T>;
  if (body.error) throw new Error(`rpc_${body.error.code}:${body.error.message}`);
  if (body.result === undefined) throw new Error("rpc_result_missing");
  return body.result;
}

/** Official/provider RPC → cached last-known result → explicit caller fallback. */
export async function arcRpcRequest<T>(input: {
  method: string;
  params?: readonly unknown[];
  cacheKey?: string;
  fallback: T | (() => T | Promise<T>);
  timeoutMs?: number;
}): Promise<ProviderFallbackResult<T>> {
  return runWithFallbackResult({
    feature: `arc-rpc:${input.method}`,
    cacheKey: input.cacheKey,
    timeoutMs: input.timeoutMs ?? 4_000,
    providers: allArcRpcUrls().map((url) => ({
      name: new URL(url).host,
      run: () => callRpc<T>(url, input.method, input.params ?? []),
    })),
    fallback: input.fallback,
  });
}
