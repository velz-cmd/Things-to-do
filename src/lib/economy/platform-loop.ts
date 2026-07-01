import {
  RESOLVE_PLATFORM_FEE_BPS,
  computePlatformFee,
} from "@/lib/payment/platform-fee";
import { getActiveRevenueStreams } from "@/lib/economy/platform-revenue";

/** Canonical business-model line for Discover and stack. */
export const PLATFORM_LOOP_TAGLINE =
  "Agents buy signals · Creators earn · Circle moves money · RESOLVE decides where";

export type PlatformFeeBreakdown = {
  grossUsd: number;
  platformFeeBps: number;
  platformFeeUsd: number;
  netToCreatorsUsd: number;
  settlementNote: string;
};

export type PlatformRevenueLoop = {
  tagline: string;
  loops: Array<{
    actor: string;
    action: string;
    rail: string;
  }>;
  liveStreams: ReturnType<typeof getActiveRevenueStreams>;
  sampleAgentInvoke: PlatformFeeBreakdown;
};

/** How RESOLVE earns today — tied to payment layer, not cosmetic. */
export function describePlatformRevenueLoop(sampleGrossUsd = 0.02): PlatformRevenueLoop {
  const sample = buildPlatformFeeBreakdown(sampleGrossUsd);
  return {
    tagline: PLATFORM_LOOP_TAGLINE,
    loops: [
      { actor: "Agents", action: "Buy signals (x402)", rail: "Circle Gateway · per request" },
      { actor: "Creators", action: "Earn on verified events", rail: "Authorization ledger → Arc payout" },
      { actor: "Circle", action: "Moves USDC", rail: "Arc · batched settlement" },
      { actor: "RESOLVE", action: "Decides where capital goes", rail: `${sample.platformFeeBps / 100}% on fulfill / settlement` },
    ],
    liveStreams: getActiveRevenueStreams(),
    sampleAgentInvoke: sample,
  };
}

export function buildPlatformFeeBreakdown(grossUsd: number): PlatformFeeBreakdown {
  const platformFeeUsd = computePlatformFee(grossUsd);
  const netToCreatorsUsd = Math.max(
    0,
    Math.round((grossUsd - platformFeeUsd) * 1_000_000) / 1_000_000,
  );
  return {
    grossUsd,
    platformFeeBps: RESOLVE_PLATFORM_FEE_BPS,
    platformFeeUsd,
    netToCreatorsUsd,
    settlementNote:
      platformFeeUsd > 0
        ? `RESOLVE platform fee (${RESOLVE_PLATFORM_FEE_BPS / 100}%) applies on settlement batches; x402 pays the signal provider per invoke.`
        : "Platform fee bps disabled in this environment.",
  };
}

export function isAgentCommerceReceipt(input: {
  eventType?: string;
  connectorId?: string;
  payeeKeyType?: string;
}): boolean {
  return (
    input.eventType === "mcp.invocation" ||
    input.connectorId === "agent_x402" ||
    input.payeeKeyType === "agent_service"
  );
}
