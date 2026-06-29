import { prisma } from "@/lib/db";
import { communityLabelForMission } from "@/lib/earn/community-label";
import { connectorLabel, payeeDisplayLabel, payeeRoleLabel } from "@/lib/ledger/labels";
import { getSettlementById } from "@/lib/payment/store";
import type { ReceiptKind } from "@/lib/receipt/copy";
import { explorerTxUrl } from "@/lib/settlement/arc-config";
import { isOnChainTxHash } from "@/lib/payment/tx-utils";

export type PublicReceiptPayee = {
  keyType: string;
  key: string;
  label: string;
  role: string;
  amountUsd: number;
  walletAddress?: string | null;
  status?: string;
};

export type PublicReceiptLineItem = {
  id: string;
  amountUsd: number;
  status: string;
  connectorId: string;
  connectorLabel: string;
  eventType: string;
  payee: PublicReceiptPayee;
  contextLabel?: string | null;
  proofHash?: string;
  createdAt: string;
  settledAt?: string | null;
};

export type PublicReceipt = {
  kind: ReceiptKind;
  id: string;
  status: string;
  amountUsd: number;
  mission: {
    id: string;
    communityName: string;
    communitySlug?: string;
    programName?: string;
  };
  connector: {
    id: string;
    label: string;
    eventType?: string;
  };
  payee?: PublicReceiptPayee;
  arc: {
    txHash: string | null;
    explorerUrl: string | null;
    onChain: boolean;
  };
  contextLabel?: string | null;
  proofHash?: string;
  createdAt: string;
  settledAt?: string | null;
  lineItems?: PublicReceiptLineItem[];
  payees?: PublicReceiptPayee[];
  currency?: string;
  payeeCount?: number;
  earningCount?: number;
};

/** @deprecated use PublicReceiptLineItem */
export type PublicReceiptSignal = PublicReceiptLineItem;

function arcBlock(txHash?: string | null) {
  const onChain = isOnChainTxHash(txHash);
  return {
    txHash: onChain ? txHash! : null,
    explorerUrl: onChain ? explorerTxUrl(txHash!) : null,
    onChain,
  };
}

async function missionBlock(missionId: string) {
  const community = await communityLabelForMission(missionId);
  return {
    id: missionId,
    communityName: community.communityName,
    communitySlug: community.communitySlug,
    programName: community.programName,
  };
}

function authorizationToLineItem(row: {
  id: string;
  amountUsd: number;
  status: string;
  connectorId: string;
  eventType: string;
  payeeKeyType: string;
  payeeKey: string;
  contextLabel: string | null;
  proofHash: string;
  createdAt: Date;
  settledAt: Date | null;
  walletAddress: string | null;
}): PublicReceiptLineItem {
  return {
    id: row.id,
    amountUsd: row.amountUsd,
    status: row.status,
    connectorId: row.connectorId,
    connectorLabel: connectorLabel(row.connectorId),
    eventType: row.eventType,
    payee: {
      keyType: row.payeeKeyType,
      key: row.payeeKey,
      label: payeeDisplayLabel(row.payeeKeyType, row.payeeKey),
      role: payeeRoleLabel(row.payeeKeyType),
      amountUsd: row.amountUsd,
      walletAddress: row.walletAddress,
      status: row.status,
    },
    contextLabel: row.contextLabel,
    proofHash: row.proofHash,
    createdAt: row.createdAt.toISOString(),
    settledAt: row.settledAt?.toISOString() ?? null,
  };
}

/** Single verified earning — one authorization row. */
export async function buildEarningReceipt(authorizationId: string): Promise<PublicReceipt | null> {
  const row = await prisma.paymentAuthorization.findUnique({
    where: { id: authorizationId },
  });
  if (!row) return null;

  const mission = await missionBlock(row.missionId);
  const txHash =
    row.settlementId ?
      (
        await prisma.missionSettlement.findUnique({
          where: { id: row.settlementId },
          select: { escrowTxHash: true },
        })
      )?.escrowTxHash
    : null;

  return {
    kind: "earning",
    id: row.id,
    status: row.status,
    amountUsd: row.amountUsd,
    mission,
    connector: {
      id: row.connectorId,
      label: connectorLabel(row.connectorId),
      eventType: row.eventType,
    },
    payee: {
      keyType: row.payeeKeyType,
      key: row.payeeKey,
      label: payeeDisplayLabel(row.payeeKeyType, row.payeeKey),
      role: payeeRoleLabel(row.payeeKeyType),
      amountUsd: row.amountUsd,
      walletAddress: row.walletAddress,
      status: row.status,
    },
    arc: arcBlock(txHash),
    contextLabel: row.contextLabel,
    proofHash: row.proofHash,
    createdAt: row.createdAt.toISOString(),
    settledAt: row.settledAt?.toISOString() ?? null,
    earningCount: 1,
  };
}

/** @deprecated use buildEarningReceipt */
export const buildSignalReceipt = buildEarningReceipt;

/** Batch payout — settlement with all recipients. */
export async function buildPayoutReceipt(settlementId: string): Promise<PublicReceipt | null> {
  const settlement = await getSettlementById(settlementId);
  if (!settlement) return null;

  const mission = await missionBlock(settlement.missionId);
  const authorizations = await prisma.paymentAuthorization.findMany({
    where: { settlementId },
    orderBy: { amountUsd: "desc" },
    take: 200,
  });

  const lineItems = authorizations.map(authorizationToLineItem);
  const connectorIds = [...new Set(authorizations.map((a) => a.connectorId))];
  const primaryConnector = connectorIds[0] ?? "resolve";

  const payeeMap = new Map<string, PublicReceiptPayee>();
  for (const item of lineItems) {
    const key = `${item.payee.keyType}:${item.payee.key}`;
    const existing = payeeMap.get(key);
    if (existing) {
      existing.amountUsd = Math.round((existing.amountUsd + item.amountUsd) * 100) / 100;
    } else {
      payeeMap.set(key, { ...item.payee });
    }
  }

  const payees = [...payeeMap.values()].sort((a, b) => b.amountUsd - a.amountUsd);
  const txHash = settlement.escrowTxHash ?? settlement.intents.find((i) => i.txHash)?.txHash ?? null;

  return {
    kind: "payout",
    id: settlement.id,
    status: settlement.status,
    amountUsd: settlement.treasuryAmount,
    mission,
    connector: {
      id: connectorIds.length === 1 ? primaryConnector : "multi",
      label:
        connectorIds.length === 1 ?
          connectorLabel(primaryConnector)
        : `${connectorIds.length} connectors`,
      eventType: authorizations[0]?.eventType,
    },
    arc: arcBlock(txHash),
    proofHash: settlement.proofHash,
    createdAt: settlement.createdAt.toISOString(),
    currency: settlement.currency,
    lineItems,
    payees,
    payeeCount: payees.length,
    earningCount: lineItems.length,
  };
}

/** @deprecated use buildPayoutReceipt */
export const buildLedgerReceipt = buildPayoutReceipt;

/** Resolve either earning (authorization id) or payout (settlement id). */
export async function buildPublicReceipt(id: string): Promise<PublicReceipt | null> {
  const earning = await buildEarningReceipt(id);
  if (earning) return earning;
  return buildPayoutReceipt(id);
}

export function receiptShareUrl(id: string, baseUrl?: string): string {
  const origin = baseUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://resolve-task.vercel.app";
  return `${origin.replace(/\/$/, "")}/receipt/${id}`;
}
