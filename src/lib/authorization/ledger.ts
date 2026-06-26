import { prisma } from "@/lib/db";
import type {
  AuthorizationStatus,
  AuthorizationSummary,
  SettlementInputEvent,
} from "@/lib/authorization/types";

export type { AuthorizationStatus, SettlementInputEvent } from "@/lib/authorization/types";

/** Ingest one normalized connector event → Authorization Ledger row. */
export async function ingestSettlementInput(
  event: SettlementInputEvent,
  options?: { founderUserId?: string },
) {
  if (event.amountUsd <= 0) {
    return { skipped: true as const, reason: "zero_amount" };
  }

  const row = await prisma.paymentAuthorization.upsert({
    where: { idempotencyKey: event.idempotencyKey },
    create: {
      connectorId: event.connectorId,
      eventType: event.eventType,
      missionId: event.missionId,
      idempotencyKey: event.idempotencyKey,
      payeeKeyType: event.payeeKeyType,
      payeeKey: event.payeeKey.toLowerCase(),
      amountUsd: event.amountUsd,
      weight: event.weight ?? 0,
      proofHash: event.proofHash,
      confidence: event.confidence ?? 0.85,
      status: "authorized",
      contextLabel: event.contextLabel,
      evidenceJson: JSON.stringify({
        evidenceRefs: event.evidenceRefs,
        occurredAt: event.occurredAt,
        raw: event.rawMetadata,
      }),
      founderUserId: options?.founderUserId,
    },
    update: {
      amountUsd: event.amountUsd,
      weight: event.weight ?? 0,
      proofHash: event.proofHash,
      confidence: event.confidence ?? 0.85,
      status: "authorized",
      contextLabel: event.contextLabel,
      evidenceJson: JSON.stringify({
        evidenceRefs: event.evidenceRefs,
        occurredAt: event.occurredAt,
        raw: event.rawMetadata,
      }),
    },
  });

  return { skipped: false as const, authorization: row };
}

export async function ingestSettlementBatch(
  events: SettlementInputEvent[],
  options?: { founderUserId?: string },
) {
  const results = [];
  for (const event of events) {
    results.push(await ingestSettlementInput(event, options));
  }
  const created = results.filter((r) => !r.skipped);
  return {
    missionId: events[0]?.missionId ?? null,
    count: created.length,
    totalUsd: events.reduce((s, e) => s + e.amountUsd, 0),
    authorizations: created.map((r) => r.authorization),
  };
}

export async function markMissionPendingFunding(missionId: string) {
  return prisma.paymentAuthorization.updateMany({
    where: { missionId, status: "authorized" },
    data: { status: "pending_funding" },
  });
}

/** Fulfillment batch — after Settlement Core runs. */
export async function fulfillMissionAuthorizations(input: {
  missionId: string;
  settlementId: string;
  settledPayeeKeys: { payeeKeyType: string; payeeKey: string; walletAddress?: string }[];
  claimablePayeeKeys: { payeeKeyType: string; payeeKey: string }[];
}) {
  const now = new Date();

  for (const p of input.settledPayeeKeys) {
    await prisma.paymentAuthorization.updateMany({
      where: {
        missionId: input.missionId,
        payeeKeyType: p.payeeKeyType,
        payeeKey: p.payeeKey.toLowerCase(),
        status: { in: ["authorized", "pending_funding", "claimable"] },
      },
      data: {
        status: "settled",
        settlementId: input.settlementId,
        walletAddress: p.walletAddress,
        fulfilledAt: now,
        settledAt: now,
      },
    });
  }

  for (const p of input.claimablePayeeKeys) {
    await prisma.paymentAuthorization.updateMany({
      where: {
        missionId: input.missionId,
        payeeKeyType: p.payeeKeyType,
        payeeKey: p.payeeKey.toLowerCase(),
        status: { in: ["authorized", "pending_funding"] },
      },
      data: {
        status: "claimable",
        settlementId: input.settlementId,
        fulfilledAt: now,
      },
    });
  }

  return prisma.paymentAuthorization.findMany({
    where: { missionId: input.missionId },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getClaimableAuthorizations(payeeKeyType: string, payeeKey: string) {
  return prisma.paymentAuthorization.findMany({
    where: {
      payeeKeyType,
      payeeKey: payeeKey.toLowerCase(),
      status: "claimable",
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAuthorizationsForPayee(
  payeeKeyType: string,
  payeeKey: string,
  statuses?: AuthorizationStatus[],
) {
  return prisma.paymentAuthorization.findMany({
    where: {
      payeeKeyType,
      payeeKey: payeeKey.toLowerCase(),
      ...(statuses?.length ? { status: { in: statuses } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
}

export async function markAuthorizationSettled(
  authorizationId: string,
  input: { settlementId?: string; walletAddress: string },
) {
  return prisma.paymentAuthorization.update({
    where: { id: authorizationId },
    data: {
      status: "settled",
      settlementId: input.settlementId,
      walletAddress: input.walletAddress,
      settledAt: new Date(),
    },
  });
}

export async function getAuthorizationSummary(input: {
  missionId?: string;
  connectorId?: string;
  payeeKeyType?: string;
  payeeKey?: string;
  contextPrefix?: string;
}): Promise<AuthorizationSummary> {
  const where: Record<string, unknown> = {};
  if (input.missionId) where.missionId = input.missionId;
  if (input.connectorId) where.connectorId = input.connectorId;
  if (input.payeeKeyType && input.payeeKey) {
    where.payeeKeyType = input.payeeKeyType;
    where.payeeKey = input.payeeKey.toLowerCase();
  }
  if (input.contextPrefix) {
    where.missionId = { startsWith: input.contextPrefix };
  }

  const rows = await prisma.paymentAuthorization.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 500,
  });

  const sum = (statuses: AuthorizationStatus[]) =>
    rows
      .filter((r) => statuses.includes(r.status as AuthorizationStatus))
      .reduce((s, r) => s + r.amountUsd, 0);

  return {
    missionId: input.missionId ?? rows[0]?.missionId ?? null,
    connectorId: input.connectorId,
    authorizedUsd: round(sum(["authorized"])),
    pendingFundingUsd: round(sum(["pending_funding"])),
    claimableUsd: round(sum(["claimable", "claimed"])),
    settledUsd: round(sum(["settled"])),
    count: rows.length,
    authorizations: rows.map((r) => ({
      id: r.id,
      payeeKey: r.payeeKey,
      payeeKeyType: r.payeeKeyType,
      amountUsd: r.amountUsd,
      status: r.status as AuthorizationStatus,
      connectorId: r.connectorId,
      contextLabel: r.contextLabel,
    })),
  };
}

export async function getAuthorizationHistory(limit = 30) {
  return prisma.paymentAuthorization.findMany({
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
}

export async function getGlobalAuthorizationSummary() {
  const rows = await prisma.paymentAuthorization.findMany({
    select: { status: true, amountUsd: true },
  }).catch(() => []);

  const sum = (statuses: AuthorizationStatus[]) =>
    rows
      .filter((r) => statuses.includes(r.status as AuthorizationStatus))
      .reduce((s, r) => s + r.amountUsd, 0);

  return {
    authorizedUsd: round(sum(["authorized"])),
    pendingFundingUsd: round(sum(["pending_funding"])),
    claimableUsd: round(sum(["claimable", "claimed"])),
    settledUsd: round(sum(["settled"])),
    count: rows.length,
  };
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}
