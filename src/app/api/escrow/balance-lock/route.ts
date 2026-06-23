import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/wallet/service";

/** Lock task budget from embedded wallet balance (no on-chain tx). */
export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to lock funds" }, { status: 401 });
  }

  const { taskId } = await req.json();
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  if (task.escrowLocked) {
    return NextResponse.json({ ok: true, task });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.availableUsd < task.budgetUsd) {
    return NextResponse.json(
      { error: `Need $${task.budgetUsd.toFixed(2)} available balance` },
      { status: 400 }
    );
  }

  const [updatedUser, updatedTask] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { availableUsd: { decrement: task.budgetUsd } },
    }),
    prisma.task.update({
      where: { id: taskId },
      data: {
        escrowLocked: true,
        userId,
        userWallet: user.walletAddress,
        status: "authorized",
      },
    }),
    prisma.walletTransaction.create({
      data: {
        userId,
        type: "lock",
        amountUsd: task.budgetUsd,
        label: `Locked for: ${task.title}`,
        status: "completed",
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    availableUsd: updatedUser.availableUsd,
    task: updatedTask,
  });
}
