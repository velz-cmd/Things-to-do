import { prisma } from "@/lib/db";
import { classifyTaskInput, type TaskClassification } from "./classifier";
import { DEMO_OUTCOMES } from "@/lib/deputy/types";
import { computeTimeoutAt } from "./timeouts";
import type { TaskStatus } from "@/lib/deputy/types";
import { runDeputyExecution } from "@/lib/deputy/orchestrator";

async function logEvent(
  taskId: string,
  agent: string,
  phase: string,
  message: string,
  metadata?: Record<string, unknown>
) {
  await prisma.taskEvent.create({
    data: {
      taskId,
      agent,
      phase,
      message,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

export async function createTaskFromIntake(
  input: string,
  classification: TaskClassification,
  userId: string,
  userWallet?: string | null
) {
  const template = DEMO_OUTCOMES.find(
    (t) =>
      t.merchantId === classification.merchantId ||
      t.description.toLowerCase().includes((classification.company ?? "").toLowerCase())
  );

  const title = classification.suggestedTitle || input;
  const now = new Date();

  const task = await prisma.task.create({
    data: {
      title,
      category: classification.category,
      company: classification.company,
      targetValueUsd: classification.targetValueUsd ?? template?.targetValueUsd ?? 1,
      successFeeUsd: 0.2,
      budgetUsd: 1.0,
      merchantId: classification.merchantId ?? template?.merchantId ?? null,
      userId,
      userWallet: userWallet ?? null,
      status: "created",
      currentAgent: "Planner",
      isDemo: classification.isDemo,
      intakeJson: JSON.stringify({ input, classification }),
      statusStartedAt: now,
      statusTimeoutAt: computeTimeoutAt("created", now),
    },
  });

  await logEvent(task.id, "Planner", "created", `Task assigned: ${title}`, {
    category: classification.category,
    company: classification.company,
    isDemo: classification.isDemo,
  });

  return task;
}

export async function setTaskStatusWithTimeout(
  taskId: string,
  status: TaskStatus,
  agent: string,
  extra?: { attentionReason?: string; paused?: boolean }
) {
  const now = new Date();
  await prisma.task.update({
    where: { id: taskId },
    data: {
      status,
      currentAgent: agent,
      statusStartedAt: now,
      statusTimeoutAt: computeTimeoutAt(status, now),
      attentionReason: extra?.attentionReason ?? null,
      paused: extra?.paused ?? false,
    },
  });
}

export async function startTask(taskId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error("Task not found");
  if (!task.escrowLocked) throw new Error("Lock Arc escrow before starting");
  if (task.paused) {
    await prisma.task.update({ where: { id: taskId }, data: { paused: false } });
  }
  void runDeputyExecution(taskId).catch(console.error);
  return prisma.task.findUnique({ where: { id: taskId } });
}

export async function pauseTask(taskId: string) {
  await prisma.task.update({
    where: { id: taskId },
    data: { paused: true, statusTimeoutAt: null },
  });
  await logEvent(taskId, "Planner", "paused", "Mission paused by user");
  return prisma.task.findUnique({ where: { id: taskId } });
}

export async function cancelTask(taskId: string) {
  await setTaskStatusWithTimeout(taskId, "cancelled", "Planner");
  await logEvent(taskId, "Planner", "cancelled", "Mission cancelled by user");
  return prisma.task.findUnique({ where: { id: taskId } });
}

export async function retryTask(taskId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error("Task not found");
  await setTaskStatusWithTimeout(taskId, "retrying", "Retry");
  await logEvent(taskId, "Retry", "retrying", "User requested retry");
  void runDeputyExecution(taskId).catch(console.error);
  return prisma.task.findUnique({ where: { id: taskId } });
}

export async function approveTask(taskId: string, action?: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error("Task not found");

  const from = task.status as TaskStatus;
  let to: TaskStatus = "executing";
  if (from === "needs_attention" || from === "escalated") {
    to = from === "escalated" ? "proof_pending" : "executing";
  } else if (from === "proof_pending") {
    to = "verified";
  }

  await setTaskStatusWithTimeout(taskId, to, "Executor", { attentionReason: undefined });
  await logEvent(
    taskId,
    "Executor",
    "approved",
    action ? `User approved: ${action}` : "User approved next action"
  );

  if (to === "executing") {
    void runDeputyExecution(taskId).catch(console.error);
  }

  return prisma.task.findUnique({ where: { id: taskId } });
}

export { classifyTaskInput };
