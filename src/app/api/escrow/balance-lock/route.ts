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
  const { taskId } = await req.json();
  const owned = await assertTaskOwner(taskId, user.id);
  if ("error" in owned) {
    return NextResponse.json({ error: owned.error }, { status: owned.status });
  }

  const task = owned.task;
  if (task.escrowLocked) {
    return NextResponse.json({ ok: true, task });
  }

  if (profile.availableUsd < task.budgetUsd) {
    return NextResponse.json(
      {
        error: `Need $${task.budgetUsd.toFixed(2)} available balance. Add funds first.`,
      },
      { status: 400 }
    );
  }

  const [updatedUser, updatedTask] = await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { availableUsd: { decrement: task.budgetUsd } },
    }),
    prisma.task.update({
      where: { id: taskId },
      data: {
        escrowLocked: true,
        userId: user.id,
        userWallet: profile.walletAddress,
        status: "authorized",
      },
    }),
    prisma.walletTransaction.create({
      data: {
        userId: user.id,
        type: "lock",
        amountUsd: task.budgetUsd,
        label: `Locked for: ${task.title}`,
        status: "completed",
      },
    }),
    prisma.taskEvent.create({
      data: {
        taskId,
        agent: "Planner",
        phase: "authorized",
        message: `Budget locked in RESOLVE agent escrow (${agentEscrowLabel()}) — $${task.budgetUsd.toFixed(2)} USDC`,
        metadata: JSON.stringify({
          escrowAgent: RESOLVE_AGENT_ESCROW_ADDRESS,
          userWallet: profile.walletAddress,
        }),
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    availableUsd: updatedUser.availableUsd,
    escrowAgent: RESOLVE_AGENT_ESCROW_ADDRESS,
    task: updatedTask,
  });
}
