import { NextResponse } from "next/server";
import { getSettlementById, getSettlementHistory } from "@/lib/payment/store";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(50, Number(searchParams.get("limit") ?? 20));
  const history = await getSettlementHistory(limit);
  return NextResponse.json({ settlements: history });
}
