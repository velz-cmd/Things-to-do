import { NextResponse } from "next/server";
import { discoverRefunds } from "@/lib/discover/discovery-service";

export async function POST() {
  const result = await discoverRefunds();
  return NextResponse.json(result);
}
