import { NextResponse } from "next/server";
import { requireReadyUser, assertTaskOwner } from "@/lib/auth/session";
import {
  startTask,
  pauseTask,
  cancelTask,
  retryTask,
  approveTask,
} from "@/lib/tasks/task-actions";
import { prisma } from "@/lib/db";

export type TaskAction = "start" | "pause" | "retry" | "approve" | "cancel";

async function loadTask(id: string) {
  return prisma.task.findUnique({
    where: { id },
    include: {
      events: { orderBy: { createdAt: "asc" } },
      proofs: true,
      microPayments: true,
    },
  });
}

export async function runTaskAction(
  taskId: string,
  userId: string,
  action: TaskAction,
  approvalAction?: string
) {
  const owned = await assertTaskOwner(taskId, userId);
  if ("error" in owned) {
    return NextResponse.json({ error: owned.error }, { status: owned.status });
  }

  try {
    switch (action) {
      case "start":
        await startTask(taskId);
        break;
      case "pause":
        await pauseTask(taskId);
        break;
      case "cancel":
        await cancelTask(taskId);
        break;
      case "retry":
        await retryTask(taskId);
        break;
      case "approve":
        await approveTask(taskId, approvalAction);
        break;
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const full = await loadTask(taskId);
    return NextResponse.json({ task: full });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Action failed" },
      { status: 400 }
    );
  }
}

export async function handleTaskActionRequest(
  req: Request,
  taskId: string,
  action: TaskAction
) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const body = action === "approve" ? await req.json().catch(() => ({})) : {};
  return runTaskAction(taskId, ready.user.id, action, body.approvalAction);
}
