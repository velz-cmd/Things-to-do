import { NextResponse } from "next/server";
import { requireReadyUser } from "@/lib/auth/session";
import { tryCheckpointBatchSettle } from "@/lib/capital/checkpoint-settle";
import { getProgramPoolState } from "@/lib/capital/pool-checkpoints";

type Params = { params: Promise<{ slug: string; programId: string }> };

export const maxDuration = 60;

export async function POST(_req: Request, { params }: Params) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const { programId } = await params;
  const result = await tryCheckpointBatchSettle(ready.user.id, programId, {
    forceThresholdUsd: undefined,
  });

  const pool = await getProgramPoolState(programId, ready.user.id);

  if (!result.ok) {
    return NextResponse.json({ ...result, pool }, { status: 400 });
  }

  return NextResponse.json({ ...result, pool });
}
