export const runtime = "nodejs";

import { createGatewayMiddleware } from "@circle-fin/x402-batching/server";
import {
  GATEWAY_FACILITATOR_TESTNET,
  getDefaultPaidSourcePriceUsd,
  getX402SellerAddress,
} from "@/lib/agent/gateway-config";
import { runGatewayMiddleware } from "@/lib/x402/next-adapter";

const priceUsd = getDefaultPaidSourcePriceUsd();
const seller = getX402SellerAddress();

function gatewayMiddleware() {
  if (!seller) return null;
  return createGatewayMiddleware({
    sellerAddress: seller,
    facilitatorUrl: GATEWAY_FACILITATOR_TESTNET,
    networks: ["eip155:5042002"],
    description: "RESOLVE premium research snippet (x402 demo)",
  });
}

/** x402-protected research payload — agents pay ~$0.007 USDC via Circle Gateway. */
export async function GET(req: Request) {
  const gateway = gatewayMiddleware();
  if (!gateway) {
    return Response.json(
      { error: "x402 seller not configured (ARC_CLIENT_WALLET_ADDRESS)" },
      { status: 503 }
    );
  }

  const price = `$${priceUsd.toFixed(3)}`;

  return runGatewayMiddleware(
    gateway.require(price) as Parameters<typeof runGatewayMiddleware>[0],
    req,
    async () => {
    return Response.json({
      source: "resolve-x402-premium",
      priceUsd,
      insight:
        "Paid research unlock: merchant policy favors compensation for delays >3h on documented bookings.",
      signals: ["receipt_found", "policy_match", "refund_eligible"],
      generatedAt: new Date().toISOString(),
    });
  });
}
