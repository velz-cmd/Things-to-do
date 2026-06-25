import { prisma } from "@/lib/db";
import {
  EXECUTION_STEPS,
  canTransition,
  hashProofPayload,
} from "@/lib/deputy/state-machine";
import type { TaskStatus, AgentRole } from "@/lib/deputy/types";
import {
  gmailSearchReceipts,
  browserSubmitClaim,
  resendSendClaim,
} from "@/lib/deputy/tools";
import { paidPremiumResearch } from "@/lib/deputy/tools/paid-resource";
import { generateDeputyPlan } from "@/lib/ai/planner";
import { generateTextWithFallback } from "@/lib/ai/gateway";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

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

import { recordExecutionCost } from "@/lib/settlement/settlement-db";
import {
  computeTimeoutAt,
  isStatusTimedOut,
  timeoutFallbackForStatus,
} from "@/lib/tasks/timeouts";

async function recordMicroPayment(
  taskId: string,
  purpose: string,
  amountUsd: number,
  agent = "Executor"
) {
  await prisma.microPayment.create({
    data: { taskId, purpose, amountUsd, txHash: null },
  });
  await recordExecutionCost({
    taskId,
    agent,
    action: purpose,
    amountUsdc: amountUsd,
    meteringMode: "offchain_metered",
    txHash: null,
  });
}

async function safeTransition(
  taskId: string,
  from: TaskStatus,
  to: TaskStatus,
  agent: AgentRole
): Promise<TaskStatus> {
  if (from === to) {
    const now = new Date();
    await prisma.task.update({
      where: { id: taskId },
      data: {
        currentAgent: agent,
        statusStartedAt: now,
        statusTimeoutAt: computeTimeoutAt(to, now),
      },
    });
    return to;
  }

  if (canTransition(from, to)) {
    const now = new Date();
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: to,
        currentAgent: agent,
        statusStartedAt: now,
        statusTimeoutAt: computeTimeoutAt(to, now),
        attentionReason: null,
      },
    });
    return to;
  }

  await prisma.task.update({
    where: { id: taskId },
    data: { status: "escalated", currentAgent: "Escalation" },
  });
  await logEvent(
    taskId,
    "Escalation",
    "escalated",
    `Invalid transition ${from} → ${to}; escalated for review`
  );

  try {
    const { text } = await generateTextWithFallback({
      tier: "fast",
      prompt: `Write a 2-sentence escalation note for a consumer advocate task stuck at ${from}.`,
    });
    await logEvent(taskId, "Escalation", "handoff", text);
  } catch {
    await logEvent(
      taskId,
      "Escalation",
      "handoff",
      "Human operator review required — state machine blocked"
    );
  }

  return "escalated";
}

export async function runTaskExecutor(taskId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error("Task not found");
  if (task.paused) return task;
  if (["settled", "failed", "refunded", "verified", "cancelled"].includes(task.status)) {
    return task;
  }

  if (
    isStatusTimedOut(task.status, task.statusTimeoutAt) &&
    task.status !== "needs_attention"
  ) {
    const fallback = timeoutFallbackForStatus(task.status as TaskStatus);
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: "needs_attention",
        attentionReason: fallback.reason,
        currentAgent: "Escalation",
        statusTimeoutAt: null,
      },
    });
    await logEvent(taskId, "Escalation", "needs_attention", fallback.reason, {
      nextAction: fallback.nextAction,
    });
    return prisma.task.findUnique({ where: { id: taskId } });
  }

  const plan = await generateDeputyPlan({
    title: task.title,
    description: task.title,
    targetValueUsd: task.targetValueUsd,
    category: task.category,
  });

  if (plan) {
    await logEvent(taskId, "Planner", "planning", `AI plan: ${plan.objective}`, {
      steps: plan.steps,
      estimatedRecoveryUsd: plan.estimatedRecoveryUsd,
    });
  }

  let currentStatus = task.status as TaskStatus;

  for (const step of EXECUTION_STEPS) {
    if (currentStatus === "escalated" || currentStatus === "needs_attention") break;

    const live = await prisma.task.findUnique({ where: { id: taskId } });
    if (live?.paused) break;

    currentStatus = await safeTransition(
      taskId,
      currentStatus,
      step.status,
      step.agent
    );
    if (currentStatus === "escalated") break;

    const message = step.message.replace(
      "$TARGET",
      task.targetValueUsd.toFixed(2)
    );
    await logEvent(taskId, step.agent, step.status, message);

    let toolCost = step.costUsd;

    if (step.status === "evidence_gathering") {
      const receipt = await gmailSearchReceipts(
        task.merchantId ?? "airline",
        task.userId
      );
      toolCost += receipt.costUsd;
      if (receipt.data) {
        await logEvent(
          taskId,
          "Evidence",
          "tool",
          `Gmail: located booking ${receipt.data.bookingRef}`,
          receipt.data
        );
      }

      const paid = await paidPremiumResearch(taskId);
      if (paid.data && paid.ok) {
        await logEvent(
          taskId,
          "AgentPay",
          "x402",
          `Paid source unlocked — $${paid.data.amountUsd.toFixed(3)} USDC`,
          paid.data
        );
      } else if (paid.costUsd > 0) {
        await logEvent(
          taskId,
          "AgentPay",
          "x402",
          paid.error ?? "Premium source metered off-chain",
          paid.data
        );
      }
    }

    if (step.status === "executing") {
      const portal = await browserSubmitClaim(
        task.merchantId === "streamdemo" || task.category === "subscription"
          ? "streamly-demo-portal"
          : `https://portal.${task.merchantId}.demo/claims`,
        taskId
      );
      toolCost += portal.costUsd;
      if (portal.data) {
        await logEvent(
          taskId,
          "Executor",
          portal.ok ? "browser" : "tool",
          portal.ok
            ? `Confirmation captured — ${portal.data.ticketId}`
            : `Portal claim submitted — ticket ${portal.data.ticketId}`,
          portal.data
        );
      }
      const email = await resendSendClaim({
        to: `support@${task.merchantId}.demo`,
        subject: `Compensation claim — ${task.title}`,
        body: "Attached evidence package per consumer rights policy.",
        taskId,
      });
      toolCost += email.costUsd;
      await logEvent(
        taskId,
        "Executor",
        "tool",
        email.ok
          ? `Outbound claim email sent via Resend (${email.data?.messageId})`
          : `Resend claim email failed: ${email.error}`
      );
    }

    if (step.status === "waiting_for_response") {
      const followUpAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await prisma.task.update({
        where: { id: taskId },
        data: { nextRunAt: followUpAt },
      });
    }

    await recordMicroPayment(taskId, `${step.agent}:${step.status}`, toolCost);
    await sleep(step.delayMs);
  }

  return prisma.task.findUnique({
    where: { id: taskId },
    include: { events: true, microPayments: true, proofs: true },
  });
}

export async function processScheduledTasks() {
  const due = await prisma.task.findMany({
    where: {
      nextRunAt: { lte: new Date() },
      status: { in: ["waiting_for_response", "retrying"] },
      paused: false,
    },
    take: 5,
  });

  for (const t of due) {
    await prisma.task.update({
      where: { id: t.id },
      data: { nextRunAt: null, status: "retrying", currentAgent: "Retry" },
    });
    await logEvent(
      t.id,
      "Retry",
      "retrying",
      "Scheduled follow-up triggered by outcome engine"
    );
    void runTaskExecutor(t.id).catch(console.error);
  }

  const timedOut = await prisma.task.findMany({
    where: {
      status: {
        in: [
          "evidence_gathering",
          "planning",
          "executing",
          "waiting_for_response",
          "retrying",
          "escalated",
          "proof_pending",
        ],
      },
      statusTimeoutAt: { lte: new Date() },
      paused: false,
    },
    take: 10,
  });

  for (const t of timedOut) {
    const fallback = timeoutFallbackForStatus(t.status as TaskStatus);
    await prisma.task.update({
      where: { id: t.id },
      data: {
        status: "needs_attention",
        attentionReason: fallback.reason,
        currentAgent: "Escalation",
        statusTimeoutAt: null,
      },
    });
    await logEvent(t.id, "Escalation", "needs_attention", fallback.reason, {
      nextAction: fallback.nextAction,
    });
  }

  return { processed: due.length, timedOut: timedOut.length };
}
