import { NextResponse } from "next/server";
import { DEMO_OUTCOMES } from "@/lib/deputy/types";

export async function GET() {
  return NextResponse.json({ outcomes: DEMO_OUTCOMES });
}
