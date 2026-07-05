import { NextResponse } from "next/server";
import { requireReadyUser } from "@/lib/auth/session";
import { getProgramPoolState } from "@/lib/capital/pool-checkpoints";

type Params = { params: Promise<{ slug: string; programId: string }> };

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: Params) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const { programId } = await params;
  const pool = await getProgramPoolState(programId, ready.user.id);
  if (!pool) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, pool });
}
