import { NextResponse } from "next/server";
import { discoverWallet } from "@/lib/discover/discovery-service";

export async function POST(req: Request) {
  const body = await req.json();
  const address = String(body.address ?? "");
  const result = await discoverWallet(address);
  return NextResponse.json(result);
}
