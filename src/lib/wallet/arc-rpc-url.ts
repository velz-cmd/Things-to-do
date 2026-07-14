/**
 * Server-only Arc testnet RPC resolution.
 * Prefer Alchemy when ALCHEMY_ARC_RPC_URL or ALCHEMY_API_KEY is set (Vercel production).
 */

const PUBLIC_ARC_RPCS = [
  "https://rpc.testnet.arc.network",
  "https://rpc.blockdaemon.testnet.arc.network",
  "https://rpc.drpc.testnet.arc.network",
  "https://rpc.quicknode.testnet.arc.network",
] as const;

function configuredFallbacks(): string[] {
  return (process.env.ARC_RPC_FALLBACK_URLS ?? "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
}

/** Full Alchemy Arc testnet URL — never expose to the client. */
export function resolveArcAlchemyRpcUrl(): string | null {
  const explicit = process.env.ALCHEMY_ARC_RPC_URL?.trim();
  if (explicit) return explicit;

  const key = process.env.ALCHEMY_API_KEY?.trim();
  if (key) return `https://arc-testnet.g.alchemy.com/v2/${key}`;

  return null;
}

/** Primary RPC for viem / server reads — Alchemy first, then env, then public. */
export function resolveArcRpcUrl(): string {
  return (
    resolveArcAlchemyRpcUrl() ??
    process.env.ARC_RPC_URL?.trim() ??
    process.env.ARC_TESTNET_RPC_URL?.trim() ??
    PUBLIC_ARC_RPCS[0]
  );
}

/** Fallback public endpoints (excludes Alchemy). */
export function listArcRpcFallbackUrls(): string[] {
  const primary = resolveArcRpcUrl();
  const fromEnv = [
    process.env.ARC_RPC_URL?.trim(),
    process.env.ARC_TESTNET_RPC_URL?.trim(),
    ...configuredFallbacks(),
    ...PUBLIC_ARC_RPCS,
  ].filter((url): url is string => Boolean(url));

  return [...new Set(fromEnv.filter((url) => url !== primary))];
}

/** All RPC URLs to try, in priority order (deduped). */
export function allArcRpcUrls(): string[] {
  const alchemy = resolveArcAlchemyRpcUrl();
  const primary = resolveArcRpcUrl();
  const candidates = [
    alchemy,
    primary,
    process.env.ARC_RPC_URL?.trim(),
    process.env.ARC_TESTNET_RPC_URL?.trim(),
    ...configuredFallbacks(),
    ...PUBLIC_ARC_RPCS,
    ...listArcRpcFallbackUrls(),
  ].filter((url): url is string => Boolean(url));
  return [...new Set(candidates)];
}

export function isArcAlchemyConfigured(): boolean {
  return Boolean(resolveArcAlchemyRpcUrl());
}
