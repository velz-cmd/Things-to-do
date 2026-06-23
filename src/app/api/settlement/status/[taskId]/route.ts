import { NextResponse } from "next/server";
import { getSettlementAdapter } from "@/lib/settlement/settlement-service";
import { listExecutionCosts } from "@/lib/settlement/settlement-db";
import { getLiveBlockers, isLiveArcEnabled } from "@/lib/settlement/arc-config";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  const adapter = getSettlementAdapter();
  const settlement = await adapter.getStatus(taskId);
  const executionCosts = await listExecutionCosts(taskId);

  return NextResponse.json({
    ok: true,
    mode: settlement.mode,
    settlement,
    executionCosts,
    liveEnabled: isLiveArcEnabled(),
    blockers: getLiveBlockers(),
  });
}
