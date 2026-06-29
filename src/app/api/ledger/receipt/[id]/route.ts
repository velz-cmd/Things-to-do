import { NextResponse } from "next/server";
import { buildPublicReceipt } from "@/lib/ledger/receipt";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const receipt = await buildPublicReceipt(id);
  if (!receipt) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }
  return NextResponse.json(receipt);
}
