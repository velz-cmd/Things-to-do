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

export type ArcRpcResult<T> =
  | {
      ok: true;
      data: T;
      provider: string;
      latencyMs: number;
      blockNumber?: bigint;
    }
  | {
      ok: false;
      code: "all_providers_unavailable" | "timeout" | "invalid_response" | "wrong_chain";
      retryAfterMs: number;
    };

const ARC_CHAIN_ID_HEX = "0x4cef52";
const DEFAULT_TIMEOUT_MS = 2_750;
const MAX_BACKOFF_MS = 60_000;
const inflight = new Map<string, Promise<ArcRpcResult<unknown>>>();
const providerFailures = new Map<string, { count: number; retryAt: number }>();

function providerName(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "arc-rpc";
  }
}

function recordProviderSuccess(url: string) {
  providerFailures.delete(url);
}

function recordProviderFailure(url: string) {
  const previous = providerFailures.get(url)?.count ?? 0;
  const count = previous + 1;
  const backoffMs = Math.min(MAX_BACKOFF_MS, 1_000 * 2 ** Math.min(count - 1, 6));
  providerFailures.set(url, { count, retryAt: Date.now() + backoffMs });
}

function availableProviders(): string[] {
  const urls = allArcRpcUrls();
  const available = urls.filter((url) => (providerFailures.get(url)?.retryAt ?? 0) <= Date.now());
  return available.length ? available : urls.slice(0, 1);
}

async function callRpc<T>(
  url: string,
  method: string,
  params: readonly unknown[],
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`rpc_http_${response.status}`);
  const body = await response.json() as JsonRpcResponse<T>;
  if (body.error) throw new Error(`rpc_${body.error.code}:${body.error.message}`);
  if (body.result === undefined) throw new Error("rpc_result_missing");
  return body.result;
}

/**
 * Sequential Arc RPC routing with provider backoff and single-flight coalescing.
 * Provider errors remain diagnostic; callers receive stable error codes.
 */
export async function arcRpcAttempt<T>(input: {
  method: string;
  params?: readonly unknown[];
  timeoutMs?: number;
  verifyChain?: boolean;
}): Promise<ArcRpcResult<T>> {
  const params = input.params ?? [];
  const key = `${input.method}:${JSON.stringify(params)}`;
  const existing = inflight.get(key) as Promise<ArcRpcResult<T>> | undefined;
  if (existing) return existing;

  const operation = (async (): Promise<ArcRpcResult<T>> => {
    let sawTimeout = false;
    let sawWrongChain = false;

    for (const url of availableProviders()) {
      const startedAt = Date.now();
      try {
        if (input.verifyChain !== false && input.method !== "eth_chainId") {
          const chainId = await callRpc<string>(
            url,
            "eth_chainId",
            [],
            input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
          );
          if (chainId.toLowerCase() !== ARC_CHAIN_ID_HEX) {
            sawWrongChain = true;
            recordProviderFailure(url);
            continue;
          }
        }

        const data = await callRpc<T>(
          url,
          input.method,
          params,
          input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        );
        recordProviderSuccess(url);
        return {
          ok: true,
          data,
          provider: providerName(url),
          latencyMs: Date.now() - startedAt,
        };
      } catch (error) {
        if (error instanceof Error && /timeout/i.test(`${error.name}:${error.message}`)) {
          sawTimeout = true;
        }
        recordProviderFailure(url);
      }
    }

    const retryAfterMs = Math.max(
      1_000,
      Math.min(
        ...allArcRpcUrls().map((url) => Math.max(0, (providerFailures.get(url)?.retryAt ?? 0) - Date.now())),
      ),
    );
    return {
      ok: false,
      code: sawWrongChain ? "wrong_chain" : sawTimeout ? "timeout" : "all_providers_unavailable",
      retryAfterMs,
    };
  })();

  inflight.set(key, operation as Promise<ArcRpcResult<unknown>>);
  try {
    return await operation;
  } finally {
    if (inflight.get(key) === operation) inflight.delete(key);
  }
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
    timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    providers: allArcRpcUrls().map((url) => ({
      name: new URL(url).host,
      run: () => callRpc<T>(url, input.method, input.params ?? []),
    })),
    fallback: input.fallback,
  });
}
