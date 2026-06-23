import { prisma } from "@/lib/db";
import type { SettlementRecord } from "@/lib/settlement/settlement-types";
import { getLiveBlockers, isLiveArcEnabled } from "@/lib/settlement/arc-config";

type DbSettlement = {
  id: string;
  taskId: string;
  mode: string;
  status: string;
  amountUsdc: string;
  executionCostUsdc: string;
  chainId: number;
  contractAddress: string | null;
  jobId: string | null;
  proofHash: string | null;
  createJobTxHash: string | null;
  approveTxHash: string | null;
  fundTxHash: string | null;
  submitProofTxHash: string | null;
  releaseTxHash: string | null;
  refundTxHash: string | null;
  explorerUrls: unknown;
  lastVerifiedAt: Date | null;
  error: string | null;
};

export function toSettlementRecord(row: DbSettlement): SettlementRecord {
  const urls = Array.isArray(row.explorerUrls)
    ? (row.explorerUrls as string[])
    : [];

  return {
    id: row.id,
    taskId: row.taskId,
    mode: row.mode as SettlementRecord["mode"],
    status: row.status as SettlementRecord["status"],
    amountUsdc: row.amountUsdc,
    executionCostUsdc: row.executionCostUsdc,
    chainId: row.chainId,
    contractAddress: row.contractAddress ?? undefined,
    jobId: row.jobId ?? undefined,
    proofHash: row.proofHash ?? undefined,
    createJobTxHash: row.createJobTxHash ?? undefined,
    approveTxHash: row.approveTxHash ?? undefined,
    fundTxHash: row.fundTxHash ?? undefined,
    submitProofTxHash: row.submitProofTxHash ?? undefined,
    releaseTxHash: row.releaseTxHash ?? undefined,
    refundTxHash: row.refundTxHash ?? undefined,
    explorerUrls: urls,
    lastVerifiedAt: row.lastVerifiedAt?.toISOString(),
    error: row.error ?? undefined,
    blockers: row.mode === "mock_arc" ? getLiveBlockers() : undefined,
  };
}

export async function getSettlementByTaskId(taskId: string) {
  return prisma.settlement.findUnique({ where: { taskId } });
}

export async function ensureSettlement(taskId: string, amountUsdc: number) {
  const existing = await getSettlementByTaskId(taskId);
  if (existing) return existing;

  const mode = isLiveArcEnabled() ? "live_arc" : "mock_arc";
  return prisma.settlement.create({
    data: {
      taskId,
      mode,
      status: "not_started",
      amountUsdc: amountUsdc.toFixed(6),
      executionCostUsdc: "0",
      chainId: 5042002,
      contractAddress: process.env.ARC_AGENTIC_COMMERCE_CONTRACT,
      explorerUrls: [],
    },
  });
}

export async function saveSettlement(
  taskId: string,
  patch: Partial<{
    mode: string;
    status: string;
    amountUsdc: string;
    executionCostUsdc: string;
    jobId: string;
    proofHash: string;
    createJobTxHash: string | null;
    approveTxHash: string | null;
    fundTxHash: string | null;
    submitProofTxHash: string | null;
    releaseTxHash: string | null;
    refundTxHash: string | null;
    explorerUrls: string[];
    error: string | null;
  }>
) {
  const row = await prisma.settlement.update({
    where: { taskId },
    data: {
      ...patch,
      explorerUrls: patch.explorerUrls,
      lastVerifiedAt: new Date(),
    },
  });
  return toSettlementRecord(row as DbSettlement);
}

export async function recordExecutionCost(input: {
  taskId: string;
  agent: string;
  action: string;
  amountUsdc: number;
  meteringMode?: string;
  txHash?: string | null;
}) {
  await prisma.executionCostEvent.create({
    data: {
      taskId: input.taskId,
      agent: input.agent,
      action: input.action,
      amountUsdc: input.amountUsdc,
      meteringMode: input.meteringMode ?? "offchain_metered",
      txHash: input.txHash ?? null,
    },
  });

  const events = await prisma.executionCostEvent.findMany({
    where: { taskId: input.taskId },
  });
  const sum = events.reduce((s, e) => s + e.amountUsdc, 0);
  await prisma.settlement.updateMany({
    where: { taskId: input.taskId },
    data: { executionCostUsdc: sum.toFixed(6) },
  });

  await prisma.task.update({
    where: { id: input.taskId },
    data: { executionCostUsd: sum },
  });
}

export async function listExecutionCosts(taskId: string) {
  return prisma.executionCostEvent.findMany({
    where: { taskId },
    orderBy: { createdAt: "asc" },
  });
}

/** Mark execution costs as batched for Circle Gateway settlement (post-mission) */
export async function batchExecutionCostsForGateway(taskId: string) {
  const events = await prisma.executionCostEvent.findMany({
    where: { taskId, meteringMode: "offchain_metered" },
  });
  if (events.length === 0) return { count: 0, totalUsdc: 0 };

  await prisma.executionCostEvent.updateMany({
    where: { taskId, meteringMode: "offchain_metered" },
    data: { meteringMode: "gateway_batched" },
  });

  const totalUsdc = events.reduce((s, e) => s + e.amountUsdc, 0);
  return { count: events.length, totalUsdc };
}
