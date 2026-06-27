import { NextResponse } from "next/server";
import { requireReadyUser } from "@/lib/auth/session";
import { buildWorkbenchSnapshot } from "@/lib/mission/server/workbench";

export async function GET() {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const workbench = await buildWorkbenchSnapshot(ready.user.id);
  return NextResponse.json({ ok: true, workbench });
}
