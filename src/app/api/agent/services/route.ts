import { NextResponse } from "next/server";
import { discoverAgentServices } from "@/lib/agent/commerce";
import { isAgentGatewayEnabled } from "@/lib/agent/gateway-config";
import { describeAgentCommerceFeePath } from "@/lib/agent/fee-path";
import {
  PLATFORM_LOOP_TAGLINE,
  describePlatformRevenueLoop,
} from "@/lib/economy/platform-loop";
import { RESOLVE_WHY_PARAGRAPH } from "@/lib/discover/resolve-doctrine";

/** Discover pay-per-signal services — agents find, pay, keep moving. */
export async function GET() {
  const services = discoverAgentServices();
  const samplePrice = services[0]?.priceUsd ?? 0.001;
  return NextResponse.json({
    ok: true,
    tagline: PLATFORM_LOOP_TAGLINE,
    doctrine: RESOLVE_WHY_PARAGRAPH,
    platformLoop: describePlatformRevenueLoop(samplePrice),
    gatewayEnabled: isAgentGatewayEnabled(),
    services,
    feePath: describeAgentCommerceFeePath(samplePrice),
    updatedAt: new Date().toISOString(),
  });
}
