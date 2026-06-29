import { NextResponse } from "next/server";
import { buildSignalReceipt } from "@/lib/ledger/receipt";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const receipt = await buildSignalReceipt(id);
  if (!receipt) {
    return NextResponse.json({ error: "Signal not found" }, { status: 404 });
  }
  return NextResponse.json(receipt);
}
