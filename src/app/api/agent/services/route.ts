import { NextResponse } from "next/server";
import { discoverAgentServices } from "@/lib/agent/commerce";
import { isAgentGatewayEnabled } from "@/lib/agent/gateway-config";

/** Discover pay-per-signal services — agents find, pay, keep moving. */
export async function GET() {
  const services = discoverAgentServices();
  return NextResponse.json({
    ok: true,
    doctrine:
      "Find service → pay per request in USDC (x402 on Arc) → authorization recorded → agent continues",
    gatewayEnabled: isAgentGatewayEnabled(),
    services,
    updatedAt: new Date().toISOString(),
  });
}
