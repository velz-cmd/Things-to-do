import { NextResponse } from "next/server";
import { buildPublicReceipt } from "@/lib/ledger/receipt";

type Params = { params: Promise<{ id: string }> };

/** Verifiable proof/receipt for a Discover action outcome. */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const receipt = await buildPublicReceipt(id);
  if (!receipt) {
    return NextResponse.json(
      { ok: false, code: "PROOF_NOT_FOUND", message: "Proof not found — settlement may be pending" },
      { status: 404 },
    );
  }
  return NextResponse.json({
    ok: true,
    action: "view_proof",
    entityId: id,
    proofId: id,
    status: receipt.status,
    receiptUrl: `/receipt/${id}`,
    txHash: receipt.arc.txHash,
    amountUsd: receipt.amountUsd,
  });
}
