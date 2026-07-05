import { prisma } from "@/lib/db";
import { communityLabelForMission } from "@/lib/earn/community-label";
import { isAgentCommerceReceipt } from "@/lib/economy/platform-loop";
import { connectorLabel, payeeDisplayLabel, payeeRoleLabel } from "@/lib/ledger/labels";
import { getSettlementById } from "@/lib/payment/store";
import {
  RESOLVE_PLATFORM_FEE_BPS,
  applyPlatformFeeSplit,
  computePlatformFee,
} from "@/lib/payment/platform-fee";
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

export type PublicReceiptPlatformFee = {
  grossUsd: number;
  platformFeeBps: number;
  platformFeeUsd: number;
  netToProviderUsd: number;
  note: string;
};

export type PublicReceipt = {
  kind: ReceiptKind;
  id: string;
  status: string;
  amountUsd: number;
  agentCommerce?: boolean;
  platformFee?: PublicReceiptPlatformFee;
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
  /** Pool checkpoint summary when program is linked to this receipt's mission */
  poolSummary?: {
    poolBalanceUsd: number;
    owedToCreatorsUsd: number;
    nextCheckpointUsd: number | null;
    progressToNextPct: number;
    payeeCategory: string;
  };
};

/** @deprecated use PublicReceiptLineItem */
export type PublicReceiptSignal = PublicReceiptLineItem;

function parseEvidenceRaw(evidenceJson: string | null): Record<string, unknown> | undefined {
  if (!evidenceJson) return undefined;
  try {
    const parsed = JSON.parse(evidenceJson) as { raw?: Record<string, unknown> };
    return parsed.raw;
  } catch {
    return undefined;
  }
}

function buildReceiptPlatformFee(input: {
  evidenceJson: string | null;
  eventType: string;
  connectorId: string;
  payeeKeyType: string;
  amountUsd: number;
}): PublicReceiptPlatformFee | undefined {
  if (
    !isAgentCommerceReceipt({
      eventType: input.eventType,
      connectorId: input.connectorId,
      payeeKeyType: input.payeeKeyType,
    })
  ) {
    return undefined;
  }

  const raw = parseEvidenceRaw(input.evidenceJson);
  const grossUsd = typeof raw?.grossUsd === "number" ? raw.grossUsd : input.amountUsd;
  const platformFeeUsd =
    typeof raw?.platformFeeUsd === "number" ? raw.platformFeeUsd : computePlatformFee(grossUsd);
  const platformFeeBps =
    typeof raw?.platformFeeBps === "number" ? raw.platformFeeBps : RESOLVE_PLATFORM_FEE_BPS;
  const netToProviderUsd =
    typeof raw?.netToProviderUsd === "number"
      ? raw.netToProviderUsd
      : Math.max(0, Math.round((grossUsd - platformFeeUsd) * 1_000_000) / 1_000_000);

  return {
    grossUsd,
    platformFeeBps,
    platformFeeUsd,
    netToProviderUsd,
    note:
      "x402 USDC pays the signal provider per invoke. RESOLVE platform fee applies on settlement batches.",
  };
}

function arcBlock(txHash?: string | null) {
  const onChain = isOnChainTxHash(txHash);
  return {
    txHash: onChain ? txHash! : null,
    explorerUrl: onChain ? explorerTxUrl(txHash!) : null,
    onChain,
  };
}

function roundUsd(n: number) {
  return Math.round(n * 100) / 100;
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

  const platformFee = buildReceiptPlatformFee({
    evidenceJson: row.evidenceJson,
    eventType: row.eventType,
    connectorId: row.connectorId,
    payeeKeyType: row.payeeKeyType,
    amountUsd: row.amountUsd,
  });

  return {
    kind: "earning",
    id: row.id,
    status: row.status,
    amountUsd: row.amountUsd,
    agentCommerce: Boolean(platformFee),
    platformFee,
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

  const grossUsd = payees.reduce((s, p) => s + p.amountUsd, 0);
  const { feeUsd: platformFeeUsd, feeBps: platformFeeBps } = applyPlatformFeeSplit(grossUsd);
  const netToCreatorsUsd = Math.max(0, roundUsd(grossUsd - platformFeeUsd));

  return {
    kind: "payout",
    id: settlement.id,
    status: settlement.status,
    amountUsd: settlement.treasuryAmount,
    platformFee: {
      grossUsd: roundUsd(grossUsd),
      platformFeeBps,
      platformFeeUsd: roundUsd(platformFeeUsd),
      netToProviderUsd: netToCreatorsUsd,
      note: `${platformFeeBps / 100}% RESOLVE platform fee on batch settlement · remainder routed to creators on Arc.`,
    },
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
  const origin = baseUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://things-to-do-eta.vercel.app";
  return `${origin.replace(/\/$/, "")}/receipt/${id}`;
}
