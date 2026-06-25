import { NextResponse } from "next/server";
import { getSettlementById } from "@/lib/payment/store";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const settlement = await getSettlementById(id);
  if (!settlement) {
    return NextResponse.json({ error: "Settlement not found" }, { status: 404 });
  }
  return NextResponse.json(settlement);
}
