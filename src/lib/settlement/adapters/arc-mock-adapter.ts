import {
  ARC_AGENTIC_COMMERCE_CONTRACT,
  ARC_CHAIN_ID,
  explorerTxUrl,
  getLiveBlockers,
} from "@/lib/settlement/arc-config";
import { verifyArcTx } from "@/lib/settlement/arc-verify";
import {
  ensureSettlement,
  getSettlementByTaskId,
  saveSettlement,
  toSettlementRecord,
} from "@/lib/settlement/settlement-db";
import type {
  CreateEscrowInput,
  RefundInput,
  ReleaseInput,
  SettlementAdapter,
  SettlementRecord,
  SubmitProofInput,
} from "@/lib/settlement/settlement-types";

export class ArcMockAdapter implements SettlementAdapter {
  mode = "mock_arc" as const;

  async createEscrow(input: CreateEscrowInput): Promise<SettlementRecord> {
    const row = await ensureSettlement(input.taskId, input.amountUsdc);
    const blockers = getLiveBlockers();

    return saveSettlement(input.taskId, {
      mode: "mock_arc",
      status: "escrow_locked",
      amountUsdc: input.amountUsdc.toFixed(6),
      jobId: `mock-${input.taskId.slice(0, 8)}`,
      createJobTxHash: null,
      approveTxHash: null,
      fundTxHash: null,
      explorerUrls: [],
      error: blockers.length
        ? `Mock mode — ${blockers.join("; ")}`
        : null,
    });
  }

  async submitProof(input: SubmitProofInput): Promise<SettlementRecord> {
    await getSettlementByTaskId(input.taskId);
    return saveSettlement(input.taskId, {
      status: "proof_submitted",
      proofHash: input.proofHash,
      submitProofTxHash: null,
    });
  }

  async release(input: ReleaseInput): Promise<SettlementRecord> {
    const row = await getSettlementByTaskId(input.taskId);
    if (!row) throw new Error("Settlement not found");
    if (!row.proofHash && row.status !== "proof_submitted") {
      throw new Error("Release blocked until proof is verified");
    }

    return saveSettlement(input.taskId, {
      status: "released",
      releaseTxHash: null,
    });
  }

  async refund(input: RefundInput): Promise<SettlementRecord> {
    await getSettlementByTaskId(input.taskId);
    return saveSettlement(input.taskId, {
      status: "refunded",
      refundTxHash: null,
      error: input.reason ?? null,
    });
  }

  async getStatus(taskId: string): Promise<SettlementRecord> {
    const row = await getSettlementByTaskId(taskId);
    if (!row) {
      const created = await ensureSettlement(taskId, 1);
      return toSettlementRecord(created as Parameters<typeof toSettlementRecord>[0]);
    }
    return toSettlementRecord(row as Parameters<typeof toSettlementRecord>[0]);
  }

  async verifyTx(txHash: string) {
    return verifyArcTx(txHash);
  }
}

export function mockSettlementLabel(record: SettlementRecord): string {
  if (record.mode !== "mock_arc") return "Live Arc";
  return record.status === "escrow_locked"
    ? "Mock mode — simulated escrow locked"
    : "Mock mode — no live Arc transaction submitted";
}

export function verifiedExplorerUrls(record: SettlementRecord): string[] {
  const hashes = [
    record.createJobTxHash,
    record.approveTxHash,
    record.fundTxHash,
    record.submitProofTxHash,
    record.releaseTxHash,
    record.refundTxHash,
  ].filter(Boolean) as string[];

  return hashes.map((h) => explorerTxUrl(h));
}

export const MOCK_CHAIN = ARC_CHAIN_ID;
export const MOCK_CONTRACT = ARC_AGENTIC_COMMERCE_CONTRACT;
