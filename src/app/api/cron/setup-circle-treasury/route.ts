import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/env/cron-secret";
import { setupCircleTreasuryWallets } from "@/lib/wallet/setup-treasury";

/**
 * Create Circle developer-controlled treasury wallets on Arc testnet.
 * Cron-auth only — run once, then copy addresses into Vercel.
 */
export async function POST(req: Request) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await setupCircleTreasuryWallets();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Treasury wallet setup failed",
        hint: "Set CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET on Vercel, redeploy, then retry.",
      },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    endpoint: "POST /api/cron/setup-circle-treasury",
    requires: ["CIRCLE_API_KEY", "CIRCLE_ENTITY_SECRET"],
    outputs: [
      "ARC_CLIENT_WALLET_ADDRESS",
      "ARC_PROVIDER_WALLET_ADDRESS",
      "ARC_CLIENT_WALLET_ID",
      "ARC_PROVIDER_WALLET_ID",
      "CIRCLE_WALLET_SET_ID",
    ],
    fund: "https://faucet.circle.com → Arc Testnet → ARC_CLIENT_WALLET_ADDRESS",
  });
}
