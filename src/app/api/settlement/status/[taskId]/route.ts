import { NextResponse } from "next/server";
import { getSettlementAdapter } from "@/lib/settlement/settlement-service";
import { listExecutionCosts } from "@/lib/settlement/settlement-db";
import { getLiveBlockers, isLiveArcEnabled } from "@/lib/settlement/arc-config";
import { requireSessionUser, assertTaskOwner } from "@/lib/auth/session";

export async function GET(_req: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const session = await requireSessionUser();
  if ("error" in session) return NextResponse.json({ ok: false, error: session.error }, { status: session.status });
  const { taskId } = await params;
  const owned = await assertTaskOwner(taskId, session.user.id);
  if ("error" in owned) return NextResponse.json({ ok: false, error: owned.error }, { status: owned.status });

  try {
    const adapter = getSettlementAdapter();
    const settlement = await adapter.getStatus(taskId);
    const executionCosts = await listExecutionCosts(taskId);
    return NextResponse.json({ ok: true, mode: settlement.mode, settlement, executionCosts, liveEnabled: isLiveArcEnabled(), blockers: getLiveBlockers() });
  } catch (error) {
    return NextResponse.json({ ok: false, mode: "unavailable", error: error instanceof Error ? error.message : "Settlement unavailable", liveEnabled: false, blockers: getLiveBlockers() }, { status: 409 });
  }
}
