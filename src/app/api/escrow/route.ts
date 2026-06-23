import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requireReadyUser,
  assertTaskOwner,
  agentEscrowLabel,
} from "@/lib/auth/session";
import { RESOLVE_AGENT_ESCROW_ADDRESS } from "@/lib/arc/config";

export async function POST(req: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const user = ready.user;
  const profile = ready.profile;
  const body = await req.json();
  const { taskId, escrowTxHash, escrowTaskId, userWallet } = body;

  if (!taskId || !escrowTxHash) {
    return NextResponse.json(
      { error: "taskId and escrowTxHash required" },
      { status: 400 }
    );
  }

  const owned = await assertTaskOwner(taskId, user.id);
  if ("error" in owned) {
    return NextResponse.json({ error: owned.error }, { status: owned.status });
  }

  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      escrowLocked: true,
      escrowTxHash,
      escrowTaskId: escrowTaskId != null ? Number(escrowTaskId) : null,
      userWallet: userWallet ?? profile.walletAddress ?? undefined,
      userId: user.id,
      status: "authorized",
    },
  });

  await prisma.taskEvent.create({
    data: {
      taskId,
      agent: "Planner",
      phase: "authorized",
      message: `Arc escrow locked — $${task.budgetUsd.toFixed(2)} USDC (agent ${agentEscrowLabel()})`,
      metadata: JSON.stringify({
        escrowTxHash,
        escrowTaskId,
        escrowAgent: RESOLVE_AGENT_ESCROW_ADDRESS,
      }),
    },
  });

  return NextResponse.json({ task, escrowAgent: RESOLVE_AGENT_ESCROW_ADDRESS });
}
