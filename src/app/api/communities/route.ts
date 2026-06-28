import { NextResponse } from "next/server";
import { requireReadyUser } from "@/lib/auth/session";
import { listCommunitySummaries } from "@/lib/communities/surface";

export async function GET() {
  const ready = await requireReadyUser();
  const userId = "error" in ready ? null : ready.user.id;
  const communities = await listCommunitySummaries(userId);
  return NextResponse.json({ ok: true, communities });
}
