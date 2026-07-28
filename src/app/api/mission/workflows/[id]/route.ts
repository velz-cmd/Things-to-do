import { NextResponse } from "next/server";
import { requireReadyUser } from "@/lib/auth/session";
import { getStructuredMission } from "@/lib/mission/server/structured-engine";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }
  const { id } = await params;
  try {
    const workflow = await getStructuredMission(ready.user.id, id);
    return NextResponse.json({ ok: true, workflow });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mission not found.";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
