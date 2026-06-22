import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const body = await req.json();
  const { taskId, escrowTxHash, escrowTaskId, userWallet } = body;

  if (!taskId || !escrowTxHash) {
    return NextResponse.json(
      { error: "taskId and escrowTxHash required" },
      { status: 400 }
    );
  }

  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      escrowLocked: true,
      escrowTxHash,
      escrowTaskId: escrowTaskId != null ? Number(escrowTaskId) : null,
      userWallet: userWallet ?? undefined,
      status: "authorized",
    },
  });

  await prisma.taskEvent.create({
    data: {
      taskId,
      agent: "Planner",
      phase: "authorized",
      message: `Arc escrow locked — $${task.budgetUsd.toFixed(2)} USDC on testnet`,
      metadata: JSON.stringify({ escrowTxHash, escrowTaskId }),
    },
  });

  return NextResponse.json({ task });
}
