import { NextResponse } from "next/server";
import { discoverAgentServices } from "@/lib/agent/commerce";
import { isAgentGatewayEnabled } from "@/lib/agent/gateway-config";
import { describeAgentCommerceFeePath } from "@/lib/agent/fee-path";

/** Discover pay-per-signal services — agents find, pay, keep moving. */
export async function GET() {
  const services = discoverAgentServices();
  const samplePrice = services[0]?.priceUsd ?? 0.001;
  return NextResponse.json({
    ok: true,
    doctrine:
      "Find a priced signal → pay USDC on Arc (x402) → mcp.invocation on ledger → mission continues.",
    gatewayEnabled: isAgentGatewayEnabled(),
    services,
    feePath: describeAgentCommerceFeePath(samplePrice),
    updatedAt: new Date().toISOString(),
  });
}
