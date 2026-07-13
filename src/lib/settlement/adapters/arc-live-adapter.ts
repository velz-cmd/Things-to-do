import { keccak256, toHex } from "viem";
import {
  ARC_AGENTIC_COMMERCE_CONTRACT,
  explorerTxUrl,
  getLiveBlockers,
  isLiveArcEnabled,
} from "@/lib/settlement/arc-config";
import {
  completeErc8183Job,
  createErc8183Escrow,
  refundErc8183Job,
  submitErc8183Proof,
} from "@/lib/settlement/circle-client";
import { verifyArcTx } from "@/lib/settlement/arc-verify";
import {
  ensureSettlement,
  getSettlementByTaskId,
  saveSettlement,
  toSettlementRecord,
} from "@/lib/settlement/settlement-db";
import { ArcMockAdapter } from "@/lib/settlement/adapters/arc-mock-adapter";
import type {
  CreateEscrowInput,
  RefundInput,
  ReleaseInput,
  SettlementAdapter,
  SettlementRecord,
  SubmitProofInput,
} from "@/lib/settlement/settlement-types";

export class ArcLiveAdapter implements SettlementAdapter {
  mode = "live_arc" as const;
  private fallback = new ArcMockAdapter();

  async createEscrow(input: CreateEscrowInput): Promise<SettlementRecord> {
    if (!isLiveArcEnabled()) {
      return this.fallback.createEscrow(input);
    }

    await ensureSettlement(input.taskId, input.amountUsdc);
    await saveSettlement(input.taskId, { status: "escrow_pending" });

    try {
      const result = await createErc8183Escrow({
        jobDescription: input.description,
        budgetUsd: input.amountUsdc,
        idempotencyKey: `task:${input.taskId}:escrow`,
      });

      const explorerUrls = [
        explorerTxUrl(result.createJobTxHash),
        explorerTxUrl(result.approveTxHash),
        explorerTxUrl(result.fundTxHash),
      ];

      return saveSettlement(input.taskId, {
        mode: "live_arc",
        status: "escrow_locked",
        jobId: result.jobId,
        createJobTxHash: result.createJobTxHash,
        approveTxHash: result.approveTxHash,
        fundTxHash: result.fundTxHash,
        explorerUrls,
        error: null,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Escrow failed";
      return saveSettlement(input.taskId, {
        status: "failed",
        error: msg,
      });
    }
  }

  async submitProof(input: SubmitProofInput): Promise<SettlementRecord> {
    const row = await getSettlementByTaskId(input.taskId);
    if (!row?.jobId) throw new Error("No Arc job for task");

    if (!isLiveArcEnabled()) {
      return this.fallback.submitProof(input);
    }

    try {
      const txHash = await submitErc8183Proof(
        row.jobId,
        input.proofHash,
        `task:${input.taskId}:proof:${input.proofHash}`,
      );
      await verifyArcTx(txHash);
      return saveSettlement(input.taskId, {
        status: "proof_submitted",
        proofHash: input.proofHash,
        submitProofTxHash: txHash,
        explorerUrls: [explorerTxUrl(txHash)],
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Proof submit failed";
      return saveSettlement(input.taskId, { status: "failed", error: msg });
    }
  }

  async release(input: ReleaseInput): Promise<SettlementRecord> {
    const row = await getSettlementByTaskId(input.taskId);
    if (!row?.jobId) throw new Error("No Arc job for task");
    if (!row.proofHash && row.status !== "proof_submitted") {
      throw new Error("Release blocked until proof is verified");
    }

    if (!isLiveArcEnabled()) {
      return this.fallback.release(input);
    }

    try {
      const reason = keccak256(
        toHex(input.reason ?? "deliverable-approved")
      );
      const txHash = await completeErc8183Job(
        row.jobId,
        reason,
        `task:${input.taskId}:release:${reason}`,
      );
      await verifyArcTx(txHash);
      return saveSettlement(input.taskId, {
        status: "released",
        releaseTxHash: txHash,
        explorerUrls: [explorerTxUrl(txHash)],
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Release failed";
      return saveSettlement(input.taskId, { status: "failed", error: msg });
    }
  }

  async refund(input: RefundInput): Promise<SettlementRecord> {
    const row = await getSettlementByTaskId(input.taskId);
    if (!row?.jobId) throw new Error("No Arc job for task");

    if (!isLiveArcEnabled()) {
      return this.fallback.refund(input);
    }

    try {
      const txHash = await refundErc8183Job(row.jobId, `task:${input.taskId}:refund`);
      await verifyArcTx(txHash);
      return saveSettlement(input.taskId, {
        status: "refunded",
        refundTxHash: txHash,
        explorerUrls: [explorerTxUrl(txHash)],
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Refund failed";
      return saveSettlement(input.taskId, { status: "failed", error: msg });
    }
  }

  async getStatus(taskId: string) {
    const row = await getSettlementByTaskId(taskId);
    if (!row) {
      const created = await ensureSettlement(taskId, 1);
      return toSettlementRecord(created as Parameters<typeof toSettlementRecord>[0]);
    }
    const record = toSettlementRecord(row as Parameters<typeof toSettlementRecord>[0]);
    return { ...record, blockers: getLiveBlockers() };
  }

  async verifyTx(txHash: string) {
    return verifyArcTx(txHash);
  }
}
