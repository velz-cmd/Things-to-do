import { NextResponse } from "next/server";
import { getTreasurySnapshot } from "@/lib/treasury/engine";

/** Treasury layer — capital, obligations, global settlement readiness */
export async function GET(req: Request) {
  const required = Number(new URL(req.url).searchParams.get("requiredUsd") ?? "0");
  const snapshot = await getTreasurySnapshot(Number.isFinite(required) ? required : 0);
  return NextResponse.json({
    ok: true,
    snapshot,
    flow: [
      "Event",
      "Attribution",
      "Authorization",
      "Treasury",
      "Settlement (Circle Arc)",
      "Claim",
      "Optional FX (USDC → EURC / cirBTC)",
    ],
    updatedAt: new Date().toISOString(),
  });
}
