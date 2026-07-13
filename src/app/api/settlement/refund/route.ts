import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSettlementAdapter } from "@/lib/settlement/settlement-service";
import { requireSessionUser, assertTaskOwner } from "@/lib/auth/session";
import type { SettlementApiResponse } from "@/lib/settlement/settlement-types";

export async function POST(req: Request) {
  const session = await requireSessionUser();
  if ("error" in session) return NextResponse.json({ ok: false, error: session.error }, { status: session.status });
  const { taskId, reason } = await req.json();
  if (!taskId) return NextResponse.json({ ok: false, error: "taskId required" }, { status: 400 });
  const owned = await assertTaskOwner(taskId, session.user.id);
  if ("error" in owned) return NextResponse.json({ ok: false, error: owned.error }, { status: owned.status });

  try {
    const adapter = getSettlementAdapter();
    const settlement = await adapter.refund({ taskId, reason });
    if (settlement.status === "refunded" && settlement.refundTxHash) {
      await prisma.task.update({ where: { id: taskId }, data: { settlementTxHash: settlement.refundTxHash, status: "refunded" } });
    }
    const body: SettlementApiResponse = { ok: settlement.status === "refunded", mode: settlement.mode, settlement };
    return NextResponse.json(body);
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Settlement refund failed" }, { status: 409 });
  }
}
