import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { requireReadyUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { appendOperationalEvent } from "@/lib/events/operational-event";
import { ARC_TESTNET_CHAIN_ID } from "@/lib/arc/config";
import { formatUsdcTokenUnits } from "@/lib/money/usdc";

const updateSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("submitted"),
    activityId: z.string().trim().min(1),
    programId: z.string().trim().min(1).optional(),
    txHash: z.string().trim().min(1).optional(),
  }),
  z.object({
    status: z.literal("confirmed"),
    txHash: z.string().trim().regex(/^0x[a-fA-F0-9]{64}$/),
    activityId: z.string().trim().min(1).optional(),
    programId: z.string().trim().min(1).optional(),
  }),
  z.object({
    status: z.literal("rejected"),
    reason: z.string().trim().min(1).max(500),
  }),
]);

type RouteContext = { params: Promise<{ id: string }> };

function safeReturnTo(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function GET(_req: Request, context: RouteContext) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const { id } = await context.params;
  const [intent, transaction] = await Promise.all([
    prisma.fundingIntent.findUnique({ where: { id } }),
    prisma.chainTransaction.findFirst({
      where: { fundingIntentId: id },
      orderBy: { submittedAt: "desc" },
      select: { txHash: true, status: true, providerTransactionId: true },
    }),
  ]);
  if (!intent) return NextResponse.json({ error: "Funding intent not found" }, { status: 404 });
  if (intent.userId !== ready.profile.id) {
    return NextResponse.json({ error: "This authorization package belongs to another account" }, { status: 403 });
  }

  return NextResponse.json({
    intent: {
      id: intent.id,
      blueprintId: intent.blueprintId,
      communitySlug: intent.communitySlug,
      programId: intent.programId,
      amountUsd: formatUsdcTokenUnits(intent.amountUsdcMicro),
      amountUsdcMicro: intent.amountUsdcMicro.toString(),
      status: intent.status,
      returnTo: safeReturnTo(intent.returnTo),
      expiresAt: intent.expiresAt?.toISOString() ?? null,
      createdAt: intent.createdAt.toISOString(),
      updatedAt: intent.updatedAt.toISOString(),
      transaction,
    },
  });
}

export async function PATCH(req: Request, context: RouteContext) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const { id } = await context.params;
  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid funding-intent update" }, { status: 400 });
  }

  const current = await prisma.fundingIntent.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Funding intent not found" }, { status: 404 });
  if (current.userId !== ready.profile.id) {
    return NextResponse.json({ error: "This authorization package belongs to another account" }, { status: 403 });
  }
  if (current.status === "confirmed" && parsed.data.status !== "confirmed") {
    return NextResponse.json({ error: "A confirmed funding intent cannot be reopened" }, { status: 409 });
  }

  const programId = "programId" in parsed.data ? parsed.data.programId ?? current.programId : current.programId;
  const updated = await prisma.fundingIntent.update({
    where: { id },
    data: { status: parsed.data.status, programId },
  });

  let transactionId: string | null = null;
  if (parsed.data.status === "confirmed") {
    const transaction = await prisma.chainTransaction.upsert({
      where: {
        chainId_txHash: {
          chainId: ARC_TESTNET_CHAIN_ID,
          txHash: parsed.data.txHash,
        },
      },
      create: {
        fundingIntentId: id,
        provider: "capital_funding",
        providerTransactionId: parsed.data.activityId ?? null,
        chainId: ARC_TESTNET_CHAIN_ID,
        txHash: parsed.data.txHash,
        amountUsdcMicro: current.amountUsdcMicro,
        status: "confirmed",
        confirmedAt: new Date(),
      },
      update: {
        fundingIntentId: id,
        providerTransactionId: parsed.data.activityId ?? undefined,
        status: "confirmed",
        confirmedAt: new Date(),
      },
    });
    transactionId = transaction.id;
  }

  if (current.communitySlug === "outcome-campaign" && current.programId) {
    const campaign = await prisma.outcomeCampaign.findFirst({ where: { id: current.programId, creatorUserId: ready.profile.id, fundingIntentId: current.id } });
    if (campaign) {
      await prisma.$transaction([
        prisma.outcomeCampaign.update({ where: { id: campaign.id }, data: { status: parsed.data.status === "confirmed" ? "ready_to_publish" : "funding_required" } }),
        prisma.campaignFundingRequirement.update({ where: { campaignId: campaign.id }, data: { status: parsed.data.status === "confirmed" ? "funded" : "authorization_required" } }),
      ]);
    }
  }

  await appendOperationalEvent({
    eventType: `capital.funding_${parsed.data.status}`,
    aggregateType: "funding_intent",
    aggregateId: id,
    userId: ready.profile.id,
    communitySlug: current.communitySlug,
    correlationId: id,
    idempotencyKey: `capital-funding:${id}:${parsed.data.status}`,
    payload: toJson({
      fundingIntentId: id,
      blueprintId: current.blueprintId,
      programId,
      amountUsdcMicro: current.amountUsdcMicro.toString(),
      activityId: "activityId" in parsed.data ? parsed.data.activityId ?? null : null,
      txHash: "txHash" in parsed.data ? parsed.data.txHash ?? null : null,
      reason: "reason" in parsed.data ? parsed.data.reason : null,
      transactionId,
    }),
  });

  return NextResponse.json({
    ok: true,
    intent: {
      id: updated.id,
      status: updated.status,
      programId: updated.programId,
      returnTo: safeReturnTo(updated.returnTo),
    },
    transactionId,
  });
}
