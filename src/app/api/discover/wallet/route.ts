import { NextResponse } from "next/server";
import { discoverWallet } from "@/lib/discover/discovery-service";

export async function POST(req: Request) {
  const body = await req.json();
  const result = await discoverWallet(String(body.address ?? ""));
  return NextResponse.json(result);
}
