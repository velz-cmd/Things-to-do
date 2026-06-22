import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { submitMerchantProof } from "@/lib/deputy/orchestrator";

/// Mock merchant webhook — simulates airline/support confirming refund
export async function POST(req: Request) {
  const body = await req.json();
  const { taskId, merchantId, refundedAmountUsd, confirmationId } = body;

  if (!taskId || !merchantId) {
    return NextResponse.json({ error: "taskId and merchantId required" }, { status: 400 });
  }

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const result = await submitMerchantProof({
    taskId,
    merchantId,
    refundedAmountUsd: refundedAmountUsd ?? task.targetValueUsd,
    confirmationId: confirmationId ?? `REF-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
  });

  return NextResponse.json({
    ok: true,
    message: "Refund confirmed by merchant",
    ...result,
  });
}
