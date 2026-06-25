import { NextResponse } from "next/server";
import { getContributorHistory } from "@/lib/payment/store";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ wallet: string }> },
) {
  const { wallet } = await params;
  if (!wallet?.match(/^0x[a-fA-F0-9]{40}$/i)) {
    return NextResponse.json({ error: "Invalid wallet" }, { status: 400 });
  }
  const payments = await getContributorHistory(wallet);
  return NextResponse.json({ wallet, payments });
}
