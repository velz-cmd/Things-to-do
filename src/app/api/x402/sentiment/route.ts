export const runtime = "nodejs";

import { createGatewayMiddleware } from "@circle-fin/x402-batching/server";
import {
  GATEWAY_FACILITATOR_TESTNET,
  getSentimentPriceUsd,
  getX402SellerAddress,
} from "@/lib/agent/gateway-config";
import { runGatewayMiddleware } from "@/lib/x402/next-adapter";
import { classifySentiment } from "@/lib/agent/sentiment";

const seller = getX402SellerAddress();

function gatewayMiddleware() {
  if (!seller) return null;
  return createGatewayMiddleware({
    sellerAddress: seller,
    facilitatorUrl: GATEWAY_FACILITATOR_TESTNET,
    networks: ["eip155:5042002"],
    description: "RESOLVE sentiment classify — pay per request in USDC",
  });
}

/**
 * x402 sentiment API — Circle Agent Stack use case.
 * Agent finds service → pays ~$0.001 USDC → gets classification → keeps moving.
 */
export async function GET(req: Request) {
  const gateway = gatewayMiddleware();
  if (!gateway) {
    return Response.json(
      { error: "x402 seller not configured (ARC_CLIENT_WALLET_ADDRESS)" },
      { status: 503 },
    );
  }

  const priceUsd = getSentimentPriceUsd();
  const price = `$${priceUsd.toFixed(3)}`;

  return runGatewayMiddleware(
    gateway.require(price) as Parameters<typeof runGatewayMiddleware>[0],
    req,
    async () => {
      const url = new URL(req.url);
      const text =
        url.searchParams.get("text")?.trim() ||
        "The product was okay but shipping took longer than expected.";

      const result = classifySentiment(text);

      return Response.json({
        source: "resolve-x402-sentiment",
        priceUsd,
        billingUnit: "request",
        input: text.slice(0, 500),
        sentiment: result.label,
        score: result.score,
        confidence: result.confidence,
        generatedAt: new Date().toISOString(),
      });
    },
  );
}
