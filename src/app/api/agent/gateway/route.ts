import { NextResponse } from "next/server";
import {
  getAgentGatewayPrivateKey,
  getAgentX402PremiumUrl,
  getDefaultPaidSourcePriceUsd,
  getX402SellerAddress,
  isAgentGatewayEnabled,
} from "@/lib/agent/gateway-config";
import { getAgentGatewayClient } from "@/lib/agent/gateway-client";

export async function GET() {
  const enabled = isAgentGatewayEnabled();
  let gatewayBalance: string | null = null;
  let walletBalance: string | null = null;

  if (enabled) {
    try {
      const client = getAgentGatewayClient();
      if (client) {
        const balances = await client.getBalances();
        gatewayBalance = balances.gateway.formattedAvailable;
        walletBalance = balances.wallet.formatted;
      }
    } catch (e) {
      console.warn("[agent/gateway] balance check failed:", e);
    }
  }

  return NextResponse.json({
    enabled,
    chain: "arcTestnet",
    premiumUrl: getAgentX402PremiumUrl(),
    defaultPriceUsd: getDefaultPaidSourcePriceUsd(),
    sellerAddress: getX402SellerAddress(),
    hasPrivateKey: Boolean(getAgentGatewayPrivateKey()),
    gatewayBalanceUsd: gatewayBalance,
    walletBalanceUsd: walletBalance,
    docs: "https://developers.circle.com/agent-stack",
    setup:
      "Set ARC_AGENT_GATEWAY_PRIVATE_KEY (funded on Arc testnet), optional AGENT_X402_PREMIUM_URL",
  });
}
