import { createHash } from "crypto";
import { ingestSettlementInput } from "@/lib/authorization/ledger";
import type { AgentSignalService } from "@/lib/agent/service-registry";
import { buildPlatformFeeBreakdown } from "@/lib/economy/platform-loop";

function proofHash(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32);
}

/** Record a paid agent invocation on the authorization ledger (pay-per-signal). */
export async function recordAgentInvocation(input: {
  service: AgentSignalService;
  taskId: string;
  missionId?: string | null;
  amountUsd: number;
  txRef?: string | null;
  contextLabel: string;
  rawMetadata?: Record<string, unknown>;
}) {
  const missionId = input.missionId ?? `agent-task:${input.taskId}`;
  const idempotencyKey = `agent-invoke:${input.service.id}:${input.taskId}:${input.txRef ?? Date.now()}`;
  const fee = buildPlatformFeeBreakdown(input.amountUsd);

  return ingestSettlementInput(
    {
      connectorId: input.service.connectorId,
      eventType: input.service.eventType,
      occurredAt: new Date().toISOString(),
      missionId,
      idempotencyKey,
      payeeKeyType: "agent_service",
      payeeKey: input.service.id,
      amountUsd: input.amountUsd,
      weight: 1,
      proofHash: proofHash([
        input.service.id,
        input.taskId,
        String(input.amountUsd),
        input.txRef ?? "",
      ]),
      confidence: input.txRef ? 0.95 : 0.75,
      contextLabel: input.contextLabel,
      evidenceRefs: input.txRef ? [`arc:${input.txRef}`] : [],
      rawMetadata: {
        ...input.rawMetadata,
        serviceId: input.service.id,
        billingUnit: input.service.billingUnit,
        rfbProgram: input.service.rfbProgram,
        commerceKind: "agent_signal",
        grossUsd: fee.grossUsd,
        platformFeeBps: fee.platformFeeBps,
        platformFeeUsd: fee.platformFeeUsd,
        netToProviderUsd: fee.netToCreatorsUsd,
      },
    },
    { status: input.txRef ? "authorized" : "pending_funding" },
  );
}
