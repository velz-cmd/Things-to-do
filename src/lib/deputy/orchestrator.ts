import { prisma, ensureStats } from "@/lib/db";
import { hashProofPayload, agentForStatus } from "@/lib/deputy/state-machine";
import type { OutcomeTemplate } from "@/lib/deputy/types";
import { settleOnArc } from "@/lib/arc/settlement";
import { refundEscrowOnArc } from "@/lib/arc/refund";
import { verifyProof } from "@/lib/deputy/proof-engine";
import { runTaskExecutor } from "@/lib/deputy/executor";

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
  return runTaskExecutor(taskId);
}

export interface MerchantProofInput {
  taskId: string;
  confirmationId: string;
  refundedAmountUsd: number;
  merchantId: string;
  artifactUrl?: string;
}

export async function submitMerchantProof(input: MerchantProofInput) {
  const task = await prisma.task.findUnique({ where: { id: input.taskId } });
  if (!task) throw new Error("Task not found");
  if (task.merchantId !== input.merchantId) {
    throw new Error("Merchant mismatch");
  }

  const secret = process.env.MERCHANT_WEBHOOK_SECRET;
  if (secret && process.env.DEPUTY_DEMO_MODE !== "true") {
    // Production: caller must pass x-merchant-secret header (checked in route)
  }

  const payload = {
    type: "refund_confirmation_email",
    confirmationId: input.confirmationId,
    refundedAmountUsd: input.refundedAmountUsd,
    merchantId: input.merchantId,
    taskId: input.taskId,
    timestamp: new Date().toISOString(),
  };

  const verification = verifyProof({
    type: payload.type,
    source: `merchant://${input.merchantId}`,
    payload,
    category: task.category,
    targetValueUsd: task.targetValueUsd,
    artifactUrl: input.artifactUrl,
  });

  const proof = await prisma.proof.create({
    data: {
      taskId: input.taskId,
      type: payload.type,
      source: `merchant://${input.merchantId}`,
      payload: JSON.stringify(payload),
      contentHash: verification.contentHash,
      artifactUrl: input.artifactUrl ?? null,
      verified: verification.verified,
    },
  });

  if (!verification.verified) {
    await failTask(input.taskId, verification.reason);
    return { proof, task: await prisma.task.findUnique({ where: { id: input.taskId } }) };
  }

  await prisma.task.update({
    where: { id: input.taskId },
    data: {
      status: "verified",
      currentAgent: "Verification",
      proofHash: verification.contentHash,
      recoveredUsd: input.refundedAmountUsd,
    },
  });

  await logEvent(
    input.taskId,
    "Verification",
    "verified",
    `Proof VERIFIED — ${verification.reason}`,
    {
      contentHash: verification.contentHash,
      confirmationId: input.confirmationId,
      policy: verification.matchedPolicy,
    }
  );

  await settleTask(input.taskId, verification.contentHash);

  return {
    proof,
    task: await prisma.task.findUnique({
      where: { id: input.taskId },
      include: { events: true, proofs: true, microPayments: true },
    }),
  };
}

async function failTask(taskId: string, reason: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return;

  await prisma.task.update({
    where: { id: taskId },
    data: { status: "failed", currentAgent: "Verification" },
  });
  await logEvent(taskId, "Verification", "failed", reason);

  if (task.escrowTaskId != null) {
    const refundTx = await refundEscrowOnArc(task.escrowTaskId);
    if (refundTx) {
      await prisma.task.update({
        where: { id: taskId },
        data: { status: "refunded", settlementTxHash: refundTx },
      });
      await logEvent(
        taskId,
        "Verification",
        "refunded",
        "Arc escrow refunded to user on failed outcome",
        { refundTx }
      );
    }
  }
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
