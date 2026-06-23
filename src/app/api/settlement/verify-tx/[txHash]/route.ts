import { NextResponse } from "next/server";
import { verifyArcTx } from "@/lib/settlement/arc-verify";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ txHash: string }> }
) {
  const { txHash } = await params;
  const verification = await verifyArcTx(txHash);
  return NextResponse.json({ ok: verification.found && verification.success, verification });
}
