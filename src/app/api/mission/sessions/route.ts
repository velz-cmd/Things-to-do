import { NextResponse } from "next/server";
import { z } from "zod";
import { requireReadyUser } from "@/lib/auth/session";
import { createMission, listMissions } from "@/lib/mission/server/missions";

const createSchema = z.object({
  title: z.string().max(200).optional(),
  ecosystemId: z.string().optional(),
});

export async function GET() {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const missions = await listMissions(ready.user.id);
  return NextResponse.json({ ok: true, missions });
}

export async function POST(req: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const mission = await createMission(ready.user.id, parsed.data);
  return NextResponse.json({ ok: true, mission });
}
