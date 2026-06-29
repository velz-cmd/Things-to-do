import { NextResponse } from "next/server";
import { buildEarningReceipt } from "@/lib/ledger/receipt";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const receipt = await buildEarningReceipt(id);
  if (!receipt) {
    return NextResponse.json({ error: "Earning not found" }, { status: 404 });
  }
  return NextResponse.json(receipt);
}
