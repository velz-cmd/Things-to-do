import { RESOLVE_AGENT_ESCROW_ADDRESS } from "@/lib/arc/config";

/** RESOLVE infrastructure fee — earns on settlement volume (bps). Default 2.5% */
export const RESOLVE_PLATFORM_FEE_BPS = Number(process.env.RESOLVE_PLATFORM_FEE_BPS ?? "250");

export const RESOLVE_PLATFORM_WALLET =
  process.env.RESOLVE_PLATFORM_FEE_WALLET?.trim() ?? RESOLVE_AGENT_ESCROW_ADDRESS;

export function computePlatformFee(amountUsd: number): number {
  if (amountUsd <= 0 || RESOLVE_PLATFORM_FEE_BPS <= 0) return 0;
  return Math.round((amountUsd * RESOLVE_PLATFORM_FEE_BPS) / 10_000 * 1_000_000) / 1_000_000;
}

export function applyPlatformFeeSplit(amountUsd: number): {
  netUsd: number;
  feeUsd: number;
  feeBps: number;
} {
  const feeUsd = computePlatformFee(amountUsd);
  return {
    netUsd: Math.max(0, Math.round((amountUsd - feeUsd) * 1_000_000) / 1_000_000),
    feeUsd,
    feeBps: RESOLVE_PLATFORM_FEE_BPS,
  };
}
