import { NextResponse } from "next/server";
import { getMissionBlueprintReceipt } from "@/lib/mission/server/mission-blueprint-receipts";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const receipt = await getMissionBlueprintReceipt(id);
    if (!receipt) {
      return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, receipt });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load report";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
