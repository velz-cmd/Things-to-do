import { NextResponse } from "next/server";
import { requireReadyUser } from "@/lib/auth/session";
import { listCommunitySummaries } from "@/lib/communities/surface";
import { getCommunitySensorStatuses } from "@/lib/sensors/status";

export async function GET() {
  const ready = await requireReadyUser();
  const userId = "error" in ready ? null : ready.user.id;
  const statuses = await getCommunitySensorStatuses();
  const communities = await listCommunitySummaries(userId, { sensorStatuses: statuses });
  return NextResponse.json({ ok: true, communities, sensorStatuses: statuses });
}
