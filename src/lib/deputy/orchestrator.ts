import { prisma, ensureStats } from "@/lib/db";
import {
  EXECUTION_STEPS,
  hashProofPayload,
  agentForStatus,
} from "@/lib/deputy/state-machine";
import type { OutcomeTemplate } from "@/lib/deputy/types";
import {
  gmailSearchReceipts,
  browserSubmitClaim,
  resendSendClaim,
} from "@/lib/deputy/tools";
import { settleOnArc } from "@/lib/arc/settlement";

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

async function recordMicroPayment(
  taskId: string,
  purpose: string,
  amountUsd: number
) {
  const txHash =
    "0x" +
    hashProofPayload({ taskId, purpose, amountUsd, t: Date.now() }).slice(2, 42);
  await prisma.microPayment.create({
    data: { taskId, purpose, amountUsd, txHash },
  });
  await prisma.task.update({
    where: { id: taskId },
    data: {
      executionCostUsd: { increment: amountUsd },
    },
  });
  return txHash;
}

export async function createTaskFromTemplate(
  template: OutcomeTemplate,
  userWallet?: string
) {
  await ensureStats();
  const task = await prisma.task.create({
    data: {
      title: template.description,
      category: template.category,
      targetValueUsd: template.targetValueUsd,
      successFeeUsd: 0.2,
      budgetUsd: 1.0,
      merchantId: template.merchantId,
      userWallet: userWallet ?? null,
      status: "created",
      currentAgent: "Planner",
    },
  });

  await logEvent(task.id, "Planner", "created", `Task assigned: ${template.title}`, {
    targetValueUsd: template.targetValueUsd,
    merchantId: template.merchantId,
  });

  return task;
}

export async function runDeputyExecution(taskId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error("Task not found");
  if (["settled", "failed", "refunded", "verified"].includes(task.status)) {
    return task;
  }

  for (const step of EXECUTION_STEPS) {
    const message = step.message.replace(
      "$TARGET",
      task.targetValueUsd.toFixed(2)
    );

    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: step.status,
        currentAgent: step.agent,
      },
    });

    await logEvent(taskId, step.agent, step.status, message);

    let toolCost = step.costUsd;
    if (step.status === "evidence_gathering") {
      const receipt = await gmailSearchReceipts(task.merchantId ?? "airline");
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
    }
    if (step.status === "executing") {
      const portal = await browserSubmitClaim(
        `https://portal.${task.merchantId}.demo/claims`
      );
      toolCost += portal.costUsd;
      if (portal.data) {
        await logEvent(
          taskId,
          "Executor",
          "tool",
          `Portal claim submitted — ticket ${portal.data.ticketId}`,
          portal.data
        );
      }
      const email = await resendSendClaim({
        to: `support@${task.merchantId}.demo`,
        subject: `Compensation claim — ${task.title}`,
        body: "Attached evidence package per consumer rights policy.",
      });
      toolCost += email.costUsd;
      await logEvent(
        taskId,
        "Executor",
        "tool",
        `Outbound claim email sent (${email.data?.messageId})`
      );
    }

    await recordMicroPayment(taskId, `${step.agent}:${step.status}`, toolCost);

    await sleep(step.delayMs);
  }

  return prisma.task.findUnique({
    where: { id: taskId },
    include: { events: true, microPayments: true, proofs: true },
  });
}

export interface MerchantProofInput {
  taskId: string;
  confirmationId: string;
  refundedAmountUsd: number;
  merchantId: string;
}

export async function submitMerchantProof(input: MerchantProofInput) {
  const task = await prisma.task.findUnique({ where: { id: input.taskId } });
  if (!task) throw new Error("Task not found");
  if (task.merchantId !== input.merchantId) {
    throw new Error("Merchant mismatch");
  }

  const payload = {
    type: "refund_confirmation",
    confirmationId: input.confirmationId,
    refundedAmountUsd: input.refundedAmountUsd,
    merchantId: input.merchantId,
    taskId: input.taskId,
    timestamp: new Date().toISOString(),
  };

  const contentHash = hashProofPayload(payload);

  const proof = await prisma.proof.create({
    data: {
      taskId: input.taskId,
      type: "refund_confirmation_email",
      source: `merchant://${input.merchantId}`,
      payload: JSON.stringify(payload),
      contentHash,
      verified: true,
    },
  });

  const verified = verifyRefundProof(task.targetValueUsd, input.refundedAmountUsd);

  if (!verified) {
    await prisma.task.update({
      where: { id: input.taskId },
      data: { status: "failed", currentAgent: "Verification" },
    });
    await logEvent(
      input.taskId,
      "Verification",
      "failed",
      "Proof rejected — refund amount does not match target"
    );
    return { proof, task: await prisma.task.findUnique({ where: { id: input.taskId } }) };
  }

  await prisma.task.update({
    where: { id: input.taskId },
    data: {
      status: "verified",
      currentAgent: "Verification",
      proofHash: contentHash,
      recoveredUsd: input.refundedAmountUsd,
    },
  });

  await logEvent(
    input.taskId,
    "Verification",
    "verified",
    `Proof VERIFIED — refund $${input.refundedAmountUsd.toFixed(2)} confirmed`,
    { contentHash, confirmationId: input.confirmationId }
  );

  await settleTask(input.taskId, contentHash);

  return {
    proof,
    task: await prisma.task.findUnique({
      where: { id: input.taskId },
      include: { events: true, proofs: true, microPayments: true },
    }),
  };
}

function verifyRefundProof(target: number, refunded: number): boolean {
  return refunded >= target * 0.95;
}

export async function settleTask(taskId: string, proofHash: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error("Task not found");

  let settlementTxHash: string | null = null;
  let settledOnChain = false;

  if (task.escrowTaskId != null) {
    const onChainHash = await settleOnArc(
      task.escrowTaskId,
      proofHash as `0x${string}`
    );
    if (onChainHash) {
      settlementTxHash = onChainHash;
      settledOnChain = true;
    }
  }

  if (!settlementTxHash) {
    settlementTxHash =
      "0x" +
      hashProofPayload({ settle: taskId, proofHash, t: Date.now() }).slice(2, 66);
  }

  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: "settled",
      currentAgent: "Verification",
      settlementTxHash,
    },
  });

  await logEvent(
    taskId,
    "Verification",
    "settled",
    settledOnChain
      ? `Arc escrow released on-chain — success fee $${task.successFeeUsd.toFixed(2)}`
      : `Arc escrow released (demo) — success fee $${task.successFeeUsd.toFixed(2)}`,
    { settlementTxHash, proofHash }
  );

  const netGain = task.recoveredUsd - task.executionCostUsd - task.successFeeUsd;

  await prisma.stats.update({
    where: { id: 1 },
    data: {
      moneyRecoveredUsd: { increment: task.recoveredUsd },
      tasksCompleted: { increment: 1 },
      executionCostUsd: { increment: task.executionCostUsd },
      subscriptionsCancelled: {
        increment: task.category === "subscription" ? 1 : 0,
      },
    },
  });

  return { settlementTxHash, netGain };
}

export async function getDashboardStats() {
  await ensureStats();
  const stats = await prisma.stats.findUnique({ where: { id: 1 } });
  const activeTasks = await prisma.task.count({
    where: { status: { notIn: ["settled", "failed", "refunded"] } },
  });
  const recentTasks = await prisma.task.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { events: { orderBy: { createdAt: "asc" }, take: 20 } },
  });

  const moneyRecovered = stats?.moneyRecoveredUsd ?? 0;
  const executionCost = stats?.executionCostUsd ?? 0;

  return {
    moneyRecoveredUsd: moneyRecovered,
    subscriptionsCancelled: stats?.subscriptionsCancelled ?? 0,
    executionCostUsd: executionCost,
    netGainUsd: moneyRecovered - executionCost,
    tasksCompleted: stats?.tasksCompleted ?? 0,
    activeTasks,
    recentTasks,
  };
}

export { agentForStatus };
