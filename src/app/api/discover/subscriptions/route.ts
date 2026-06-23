import { NextResponse } from "next/server";
import { discoverSubscriptions } from "@/lib/discover/discovery-service";

export async function POST() {
  const result = await discoverSubscriptions();
  return NextResponse.json(result);
}
