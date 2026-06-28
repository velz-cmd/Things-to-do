import { NextResponse } from "next/server";
import { getCommunitySensorStatuses } from "@/lib/sensors/status";

export async function GET() {
  const statuses = await getCommunitySensorStatuses();
  return NextResponse.json({ ok: true, statuses });
}
