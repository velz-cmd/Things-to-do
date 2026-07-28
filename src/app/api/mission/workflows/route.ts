import { NextResponse } from "next/server";
import { requireReadyUser } from "@/lib/auth/session";
import { missionManifestSchema } from "@/lib/mission/structured-contract";
import {
  createStructuredMission,
  listStructuredMissions,
} from "@/lib/mission/server/structured-engine";

export async function GET() {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }
  const missions = await listStructuredMissions(ready.user.id);
  return NextResponse.json({ ok: true, missions });
}

export async function POST(request: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }
  const body = await request.json().catch(() => null);
  const parsed = missionManifestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({
      error: "Mission requirements are incomplete.",
      issues: parsed.error.issues,
    }, { status: 400 });
  }
  try {
    const workflow = await createStructuredMission(ready.user.id, parsed.data);
    return NextResponse.json({ ok: true, workflow }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mission creation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
