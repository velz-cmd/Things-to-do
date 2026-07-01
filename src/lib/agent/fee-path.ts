import {
  RESOLVE_PLATFORM_FEE_BPS,
  RESOLVE_PLATFORM_WALLET,
  computePlatformFee,
} from "@/lib/payment/platform-fee";

/** Documents how RESOLVE earns on agent signal commerce (Circle find → pay → move). */
export function describeAgentCommerceFeePath(amountUsd: number) {
  const platformFeeUsd = computePlatformFee(amountUsd);
  return {
    flow: ["find", "pay_x402", "ledger_authorize", "settlement_optional"],
    x402Recipient: "ARC seller wallet (micro-service operator)",
    platformFeeBps: RESOLVE_PLATFORM_FEE_BPS,
    platformFeeUsd,
    platformWallet: RESOLVE_PLATFORM_WALLET,
    note:
      "x402 USDC pays the signal provider per request (Circle facilitator routes to seller wallet). On program settlement batches, RESOLVE_PLATFORM_FEE_BPS applies to authorized amounts; agent mcp.invocation rows record execution cost separately.",
  };
}
