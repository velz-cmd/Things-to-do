import { NextResponse } from "next/server";
import { discoverParcels } from "@/lib/discover/discovery-service";

export async function POST() {
  const result = await discoverParcels();
  return NextResponse.json(result);
}
