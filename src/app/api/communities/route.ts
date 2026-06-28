import { NextResponse } from "next/server";
import { requireReadyUser } from "@/lib/auth/session";
import { listCommunitySummaries } from "@/lib/communities/surface";
import { getCommunitySensorStatuses } from "@/lib/sensors/status";

export async function GET() {
  const ready = await requireReadyUser();
  const userId = "error" in ready ? null : ready.user.id;
  const [communities, statuses] = await Promise.all([
    listCommunitySummaries(userId),
    getCommunitySensorStatuses(),
  ]);
  return NextResponse.json({ ok: true, communities, sensorStatuses: statuses });
}
