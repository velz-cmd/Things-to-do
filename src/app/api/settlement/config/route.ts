import { NextResponse } from "next/server";
import { getLiveBlockers, isLiveArcEnabled } from "@/lib/settlement/arc-config";
import { getSettlementMode } from "@/lib/settlement/settlement-service";

export async function GET() {
  const mode = await getSettlementMode();
  return NextResponse.json({
    mode,
    liveEnabled: isLiveArcEnabled(),
    blockers: getLiveBlockers(),
  });
}
