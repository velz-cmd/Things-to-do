import { NextResponse } from "next/server";
import { verifySettlementOnChain } from "@/lib/github/proof-engine";

/** Post-settlement proof verification via Blockscout — never used for scoring. */
export async function GET(req: Request) {
  const txHash = new URL(req.url).searchParams.get("txHash");
  if (!txHash) {
    return NextResponse.json({ error: "txHash query param required" }, { status: 400 });
  }
  const result = await verifySettlementOnChain(txHash);
  return NextResponse.json(result);
}
