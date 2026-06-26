import { NextResponse } from "next/server";
import { getConnectorLiveStatuses } from "@/lib/connectors/live-stats";

/** Live Distribution Connector stats — real ledger + integration health */
export async function GET() {
  const connectors = await getConnectorLiveStatuses();
  return NextResponse.json({
    connectors,
    updatedAt: new Date().toISOString(),
  });
}
