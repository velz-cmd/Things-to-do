import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSettlementAdapter } from "@/lib/settlement/settlement-service";
import { requireSessionUser } from "@/lib/auth/session";
import type { SettlementApiResponse } from "@/lib/settlement/settlement-types";

export async function POST(req: Request) {
  const session = await requireSessionUser();
  if ("error" in session) {
    return NextResponse.json({ ok: false, error: session.error }, { status: session.status });
  }

  const { taskId, reason } = await req.json();
  if (!taskId) {
    return NextResponse.json({ ok: false, error: "taskId required" }, { status: 400 });
  }

  const adapter = getSettlementAdapter();
  const settlement = await adapter.release({ taskId, reason });

  if (settlement.status === "released" && settlement.releaseTxHash) {
    await prisma.task.update({
      where: { id: taskId },
      data: { settlementTxHash: settlement.releaseTxHash },
    });
  }

  const body: SettlementApiResponse = {
    ok: settlement.status === "released",
    mode: settlement.mode,
    settlement,
    message:
      settlement.mode === "mock_arc"
        ? "Mock release — no live Arc transaction"
        : "Settlement released on Arc",
  };
  return NextResponse.json(body);
}
