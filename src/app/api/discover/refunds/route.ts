import { NextResponse } from "next/server";
import { discoverRefunds } from "@/lib/discover/discovery-service";
import { getSessionUserId } from "@/lib/auth/session";

export async function POST() {
  const userId = await getSessionUserId();
  const result = await discoverRefunds(userId);
  return NextResponse.json(result);
}
