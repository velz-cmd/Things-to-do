import { NextResponse } from "next/server";
import { requireReadyUser } from "@/lib/auth/session";
import { buildLiveTimeline } from "@/lib/mission/server/timeline";

export async function GET(req: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const url = new URL(req.url);
  const ecosystemId = url.searchParams.get("ecosystemId") ?? undefined;
  const missionId = url.searchParams.get("missionId") ?? undefined;

  const timeline = await buildLiveTimeline(ready.user.id, {
    ecosystemId,
    missionIds: missionId ? [missionId] : undefined,
  });

  return NextResponse.json({ ok: true, timeline });
}
