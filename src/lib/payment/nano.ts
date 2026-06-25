import { sendUsdcWithMemo } from "@/lib/arc/memo";
import { ARC_PROVIDER_WALLET_ADDRESS } from "@/lib/settlement/arc-config";
import { isLiveArcEnabled } from "@/lib/settlement/arc-config";
import { buildAgentNanoMemo } from "@/lib/payment/memo";
import { AGENT_NANO_RATES, type NanoPaymentRecord } from "@/lib/payment/types";

const DEFAULT_AGENTS = [
  "identity_worker",
  "repository_worker",
  "pr_worker",
  "code_worker",
  "collaboration_worker",
  "impact_worker",
  "reputation_worker",
  "ecosystem_worker",
  "reasoning_engine",
] as const;

/**
 * Circle Nano Payment Layer — pay pipeline agents micro-amounts with Arc memos.
 * Batched before contributor settlement. Never decides who deserves money.
 */
export async function executeAgentNanoPayments(input: {
  missionId: string;
  proofHash: string;
  batchNumber: number;
  agentsRun?: string[];
}): Promise<NanoPaymentRecord[]> {
  const recipient =
    process.env.PAYMENT_AGENT_WALLET?.trim() ??
    ARC_PROVIDER_WALLET_ADDRESS ??
    "";

  if (!recipient || !/^0x[a-fA-F0-9]{40}$/.test(recipient)) {
    return DEFAULT_AGENTS.map((role) => ({
      agentRole: role,
      purpose: `RESOLVE ${role}`,
      amountUsd: AGENT_NANO_RATES[role] ?? 0.05,
      recipientWallet: "unconfigured",
      memoText: buildAgentNanoMemo({
        missionId: input.missionId,
        agentRole: role,
        proofHash: input.proofHash,
        batchNumber: input.batchNumber,
      }),
      status: "failed" as const,
    }));
  }

  const agents =
    input.agentsRun?.length ?
      input.agentsRun.filter((a) => AGENT_NANO_RATES[a] != null)
    : [...DEFAULT_AGENTS];

  const records: NanoPaymentRecord[] = [];

  for (const role of agents) {
    const amountUsd = AGENT_NANO_RATES[role] ?? 0.05;
    const memoText = buildAgentNanoMemo({
      missionId: input.missionId,
      agentRole: role,
      proofHash: input.proofHash,
      batchNumber: input.batchNumber,
    });

    const record: NanoPaymentRecord = {
      agentRole: role,
      purpose: `RESOLVE ${role.replace(/_/g, " ")}`,
      amountUsd,
      recipientWallet: recipient,
      memoText,
      status: "pending",
    };

    if (isLiveArcEnabled() && amountUsd > 0) {
      try {
        const result = await sendUsdcWithMemo({
          recipient: recipient as `0x${string}`,
          amountUsd,
          memo: memoText,
          memoRef: `nano:${input.missionId}:${role}:${input.batchNumber}`,
        });
        record.txHash = result.txHash;
        record.status = "settled";
      } catch (e) {
        console.warn(`[nano-pay] ${role} failed:`, e);
        record.status = "failed";
      }
    } else {
      record.status = "settled";
      record.txHash = `offchain-nano-${role}`;
    }

    records.push(record);
  }

  return records;
}

export function totalNanoUsd(records: NanoPaymentRecord[]): number {
  return records.reduce((s, r) => s + r.amountUsd, 0);
}
