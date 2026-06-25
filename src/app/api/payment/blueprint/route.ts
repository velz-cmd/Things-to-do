import { NextResponse } from "next/server";
import { PAYMENT_LAYER_BLUEPRINT } from "@/lib/payment/blueprint";

export async function GET() {
  return NextResponse.json(PAYMENT_LAYER_BLUEPRINT);
}
