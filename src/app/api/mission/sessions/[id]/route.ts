import { NextResponse } from "next/server";
import { requireReadyUser } from "@/lib/auth/session";
import { deleteMission, getMission } from "@/lib/mission/server/missions";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const { id } = await params;
  const mission = await getMission(ready.user.id, id);
  if (!mission) {
    return NextResponse.json({ error: "Mission not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, mission });
}

export async function DELETE(_req: Request, { params }: Params) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const { id } = await params;
  await deleteMission(ready.user.id, id);
  return NextResponse.json({ ok: true });
}
