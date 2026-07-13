import { NextResponse } from "next/server";
import { getSettlementAdapter } from "@/lib/settlement/settlement-service";
import { requireSessionUser, assertTaskOwner } from "@/lib/auth/session";
import type { SettlementApiResponse } from "@/lib/settlement/settlement-types";

export async function POST(req: Request) {
  const session = await requireSessionUser();
  if ("error" in session) return NextResponse.json({ ok: false, error: session.error }, { status: session.status });
  const { taskId, proofHash } = await req.json();
  if (!taskId || !proofHash) return NextResponse.json({ ok: false, error: "taskId and proofHash required" }, { status: 400 });
  const owned = await assertTaskOwner(taskId, session.user.id);
  if ("error" in owned) return NextResponse.json({ ok: false, error: owned.error }, { status: owned.status });

  try {
    const adapter = getSettlementAdapter();
    const settlement = await adapter.submitProof({ taskId, proofHash });
    const body: SettlementApiResponse = { ok: settlement.status !== "failed", mode: settlement.mode, settlement, message: "Proof hash submitted to Arc settlement layer" };
    return NextResponse.json(body);
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Proof submission failed" }, { status: 409 });
  }
}
