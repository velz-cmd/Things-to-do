import { NextResponse } from "next/server";
import { getAuthorizationHistory } from "@/lib/authorization/ledger";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(100, Number(searchParams.get("limit") ?? 30));
  const rows = await getAuthorizationHistory(limit);
  return NextResponse.json({ authorizations: rows });
}
