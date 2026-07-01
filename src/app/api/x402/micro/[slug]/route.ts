export const runtime = "nodejs";

import { createGatewayMiddleware } from "@circle-fin/x402-batching/server";
import {
  GATEWAY_FACILITATOR_TESTNET,
  getX402SellerAddress,
} from "@/lib/agent/gateway-config";
import { runGatewayMiddleware } from "@/lib/x402/next-adapter";
import { X402_MICRO_SERVICES } from "@/lib/agent/x402-micro";

type Params = { params: Promise<{ slug: string }> };

function gatewayMiddleware() {
  const seller = getX402SellerAddress();
  if (!seller) return null;
  return createGatewayMiddleware({
    sellerAddress: seller,
    facilitatorUrl: GATEWAY_FACILITATOR_TESTNET,
    networks: ["eip155:5042002"],
    description: "RESOLVE agent micro-service — pay per signal on Arc",
  });
}

export async function GET(req: Request, { params }: Params) {
  const { slug } = await params;
  const def = X402_MICRO_SERVICES[slug];
  if (!def) {
    return Response.json({ error: "Unknown micro-service" }, { status: 404 });
  }

  const gateway = gatewayMiddleware();
  if (!gateway) {
    return Response.json(
      { error: "x402 seller not configured (ARC_CLIENT_WALLET_ADDRESS)" },
      { status: 503 },
    );
  }

  const price = `$${def.priceUsd.toFixed(def.priceUsd >= 0.01 ? 2 : 3)}`;

  return runGatewayMiddleware(
    gateway.require(price) as Parameters<typeof runGatewayMiddleware>[0],
    req,
    async () => {
      const url = new URL(req.url);
      const text = url.searchParams.get("text")?.trim() ?? "";
      const result = def.run(text);
      return Response.json({
        source: `resolve-x402-micro:${slug}`,
        ...result,
      });
    },
  );
}
