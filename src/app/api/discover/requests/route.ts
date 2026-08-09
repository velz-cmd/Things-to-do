import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import type { Prisma } from "@prisma/client";
import { ARC_TESTNET_CHAIN_ID } from "@/lib/arc/config";
import { requireReadyUser } from "@/lib/auth/session";
import { cacheDelete } from "@/lib/cache/kv";
import { prisma } from "@/lib/db";
import { canonicalOutcomeHref } from "@/lib/discover/receipt-links";
import { discoverRequestCommandSchema } from "@/lib/discover/request-contract";
import { DISCOVER_MARKETPLACE_SOURCE_CACHE_KEYS } from "@/lib/discover/marketplace/cache";
import { DISCOVER_MARKETPLACE_ACTIVITY_CACHE_TAG } from "@/lib/discover/marketplace/query";
import {
  ARC_CLIENT_WALLET_ADDRESS,
  ARC_PROVIDER_WALLET_ADDRESS,
  getLiveBlockers,
  isLiveArcEnabled,
} from "@/lib/settlement/arc-config";
import { getSettlementAdapter } from "@/lib/settlement/settlement-service";

export const maxDuration = 120;

const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

function slug(title: string, id: string) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72);
  return `${base || "request"}-${id.slice(0, 8)}`;
}

async function invalidateRequests() {
  await cacheDelete(DISCOVER_MARKETPLACE_SOURCE_CACHE_KEYS.published);
  revalidateTag(DISCOVER_MARKETPLACE_ACTIVITY_CACHE_TAG);
}

async function requestRecord(opportunityId: string) {
  return prisma.discoverOpportunity.findFirst({
    where: { id: opportunityId, sourceType: "resolve_request" },
  });
}

async function ownerRequest(opportunityId: string, userId: string) {
  const opportunity = await requestRecord(opportunityId);
  if (!opportunity) return { error: "Request not found", status: 404 as const };
  if (opportunity.creatorId !== userId) {
    return { error: "Only the requester can perform this action", status: 403 as const };
  }
  if (!opportunity.projectId) {
    return { error: "This request has no canonical settlement task", status: 409 as const };
  }
  return { opportunity };
}

export async function GET(request: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }
  const opportunityId = new URL(request.url).searchParams.get("opportunityId")?.trim();
  if (!opportunityId) {
    return NextResponse.json({ error: "opportunityId is required" }, { status: 400 });
  }
  const opportunity = await requestRecord(opportunityId);
  if (!opportunity) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  const owner = opportunity.creatorId === ready.user.id;
  const selected = opportunity.selectedProviderId === ready.user.id;
  if (opportunity.visibility !== "public" && !owner && !selected) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  const [application, applications, activity, task] = await Promise.all([
    prisma.discoverApplication.findUnique({
      where: {
        opportunityId_userId: { opportunityId, userId: ready.user.id },
      },
    }),
    owner
      ? prisma.discoverApplication.findMany({
          where: { opportunityId, status: { not: "withdrawn" } },
          orderBy: { submittedAt: "desc" },
          take: 25,
        })
      : Promise.resolve([]),
    prisma.discoverOpportunityActivity.findMany({
      where: { opportunityId },
      orderBy: { occurredAt: "desc" },
      take: 30,
    }),
    opportunity.projectId && (owner || selected)
      ? prisma.task.findUnique({
          where: { id: opportunity.projectId },
          include: { settlement: true },
        })
      : Promise.resolve(null),
  ]);
  return NextResponse.json({
    opportunity,
    viewer: { owner, selected, application },
    applications,
    activity,
    settlement: task?.settlement ?? null,
  });
}

export async function POST(request: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }
  const parsed = discoverRequestCommandSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request action" },
      { status: 400 },
    );
  }
  const command = parsed.data;

  if (command.action === "create") {
    const sourceId = `request:${ready.user.id}:${command.idempotencyKey}`;
    const existing = await prisma.discoverOpportunity.findUnique({
      where: {
        sourceType_sourceId: { sourceType: "resolve_request", sourceId },
      },
    });
    if (existing) {
      return NextResponse.json({
        ok: true,
        replayed: true,
        opportunityId: existing.id,
        status: existing.status,
      });
    }
    const id = randomUUID();
    const deadline = command.deadline ? new Date(command.deadline) : null;
    if (deadline && deadline <= new Date()) {
      return NextResponse.json({ error: "Deadline must be in the future" }, { status: 400 });
    }
    const created = await prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          userId: ready.user.id,
          title: command.title,
          category: "discover_request",
          targetValueUsd: command.budgetUsd,
          budgetUsd: command.budgetUsd,
          status: "ready_to_fund",
          userWallet: ready.profile.walletAddress,
          intakeJson: JSON.stringify({
            version: 1,
            requestType: command.requestType,
            description: command.description,
            repository: command.repository,
            communityName: command.communityName,
            evidenceRequirement: command.evidenceRequirement,
            acceptanceRequirement: command.acceptanceRequirement,
            deadline: command.deadline,
            asset: "USDC",
            network: "ARC-TESTNET",
            settlementType: "conditional_escrow",
          }),
        },
      });
      const opportunity = await tx.discoverOpportunity.create({
        data: {
          id,
          slug: slug(command.title, id),
          title: command.title,
          summary: command.description.slice(0, 240),
          description: command.description,
          type: command.requestType,
          status: "ready_to_fund",
          visibility: "private",
          creatorType: "individual",
          creatorId: ready.user.id,
          creatorName:
            ready.profile.displayName ??
            ready.profile.githubUsername ??
            ready.profile.email ??
            "Requester",
          communityName: command.communityName,
          projectId: task.id,
          repository: command.repository,
          category: "funded_request",
          deliverables: [command.acceptanceRequirement],
          evidenceRequirements: [command.evidenceRequirement],
          eligibility: [],
          rewardAmountUsd: command.budgetUsd,
          rewardToken: "USDC",
          rewardNetwork: "ARC-TESTNET",
          fundedAmountUsd: 0,
          fundingGoalUsd: command.budgetUsd,
          fundingStatus: "unfunded",
          paymentMode: "conditional_escrow",
          distributionMethod: "requester_approval",
          deadline,
          remote: true,
          sourceType: "resolve_request",
          sourceId,
          verificationStatus: "requester_created",
        },
      });
      await tx.discoverOpportunityActivity.create({
        data: {
          opportunityId: opportunity.id,
          eventType: "request_created",
          actorId: ready.user.id,
          summary: "The requester prepared a conditional Arc request.",
          metadata: json({ taskId: task.id, budgetUsd: command.budgetUsd }),
        },
      });
      await tx.actionRun.create({
        data: {
          userId: ready.user.id,
          actionId: "discover.post_request",
          aggregateType: "DiscoverOpportunity",
          aggregateId: opportunity.id,
          idempotencyKey: sourceId,
          state: "completed",
          recommendationReason:
            "The user explicitly created a request with evidence, acceptance, budget, and settlement requirements.",
          input: json(command),
          output: json({ opportunityId: opportunity.id, taskId: task.id }),
          completedAt: new Date(),
        },
      });
      return { opportunity, task };
    });
    await invalidateRequests();
    return NextResponse.json(
      {
        ok: true,
        opportunityId: created.opportunity.id,
        taskId: created.task.id,
        status: created.opportunity.status,
        nextAction: "fund_publish",
      },
      { status: 201 },
    );
  }

  if (command.action === "take") {
    const opportunity = await requestRecord(command.opportunityId);
    if (!opportunity) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
    if (opportunity.creatorId === ready.user.id) {
      return NextResponse.json({ error: "You cannot take your own request" }, { status: 409 });
    }
    if (opportunity.status !== "open" || opportunity.fundingStatus !== "escrowed") {
      return NextResponse.json({ error: "This request is not funded and open" }, { status: 409 });
    }
    const payout = await prisma.payoutDestination.findFirst({
      where: {
        userId: ready.user.id,
        identityId: null,
        status: "verified",
        verifiedAt: { not: null },
        network: "ARC-TESTNET",
        asset: "USDC",
      },
      orderBy: { verifiedAt: "desc" },
    });
    if (!payout) {
      return NextResponse.json(
        { error: "Choose and verify an Arc Testnet USDC payout destination before taking this request", code: "payout_required" },
        { status: 409 },
      );
    }
    const claimed = await prisma.$transaction(async (tx) => {
      const updated = await tx.discoverOpportunity.updateMany({
        where: { id: opportunity.id, status: "open", selectedProviderId: null },
        data: {
          status: "assigned",
          applicationCount: { increment: 1 },
          selectedProviderId: ready.user.id,
          selectedProviderName:
            ready.profile.displayName ?? ready.profile.githubUsername ?? "Contributor",
        },
      });
      if (updated.count !== 1) return null;
      const application = await tx.discoverApplication.upsert({
        where: {
          opportunityId_userId: {
            opportunityId: opportunity.id,
            userId: ready.user.id,
          },
        },
        create: {
          opportunityId: opportunity.id,
          userId: ready.user.id,
          status: "assigned",
          proposal: command.proposal,
        },
        update: { status: "assigned", proposal: command.proposal },
      });
      await tx.discoverOpportunityActivity.create({
        data: {
          opportunityId: opportunity.id,
          eventType: "request_assigned",
          actorId: ready.user.id,
          summary: "A payout-ready contributor took the request.",
        },
      });
      return application;
    });
    if (!claimed) {
      return NextResponse.json({ error: "Another contributor already took this request" }, { status: 409 });
    }
    await invalidateRequests();
    return NextResponse.json({ ok: true, status: "assigned", applicationId: claimed.id });
  }

  if (command.action === "fund_publish") {
    const owned = await ownerRequest(command.opportunityId, ready.user.id);
    if ("error" in owned) {
      return NextResponse.json({ error: owned.error }, { status: owned.status });
    }
    const opportunity = owned.opportunity;
    if (opportunity.status === "open" && opportunity.fundingStatus === "escrowed") {
      return NextResponse.json({ ok: true, replayed: true, status: "open" });
    }
    if (!isLiveArcEnabled()) {
      return NextResponse.json(
        {
          error: "Request funding is unavailable until the canonical Arc escrow checks pass.",
          code: "arc_escrow_unavailable",
          blockers: getLiveBlockers(),
        },
        { status: 409 },
      );
    }
    if (!opportunity.projectId) {
      return NextResponse.json({ error: "Canonical request task is missing" }, { status: 409 });
    }
    const settlement = await getSettlementAdapter().createEscrow({
      taskId: opportunity.projectId,
      amountUsdc: opportunity.rewardAmountUsd ?? 0,
      description: opportunity.title,
      clientWallet: ready.profile.walletAddress ?? undefined,
    });
    if (settlement.status !== "escrow_locked") {
      return NextResponse.json(
        { error: settlement.error ?? "Arc escrow was not confirmed", settlement },
        { status: 409 },
      );
    }
    await prisma.$transaction([
      prisma.task.update({
        where: { id: opportunity.projectId },
        data: {
          status: "authorized",
          escrowLocked: true,
          escrowTxHash: settlement.fundTxHash,
          escrowTaskId:
            settlement.jobId && /^\d+$/.test(settlement.jobId)
              ? Number(settlement.jobId)
              : null,
        },
      }),
      prisma.discoverOpportunity.update({
        where: { id: opportunity.id },
        data: {
          status: "open",
          visibility: "public",
          fundingStatus: "escrowed",
          fundedAmountUsd: opportunity.rewardAmountUsd,
          verificationStatus: "escrow_confirmed",
          publishedAt: new Date(),
        },
      }),
      prisma.discoverOpportunityActivity.create({
        data: {
          opportunityId: opportunity.id,
          eventType: "request_funded",
          actorId: ready.user.id,
          summary: "The request budget was confirmed in Arc escrow and published.",
          metadata: json({
            taskId: opportunity.projectId,
            jobId: settlement.jobId,
            fundTxHash: settlement.fundTxHash,
          }),
        },
      }),
    ]);
    await invalidateRequests();
    return NextResponse.json({ ok: true, status: "open", settlement });
  }

  if (command.action === "submit_work") {
    const opportunity = await requestRecord(command.opportunityId);
    if (!opportunity) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
    if (opportunity.selectedProviderId !== ready.user.id || opportunity.status !== "assigned") {
      return NextResponse.json({ error: "Only the assigned contributor can submit work" }, { status: 403 });
    }
    const evidence = await prisma.evidence.findMany({
      where: {
        id: { in: command.evidenceIds },
        sourceUrl: { not: null },
        confidencePpm: { gte: 500_000 },
      },
      select: { id: true },
    });
    if (evidence.length !== new Set(command.evidenceIds).size) {
      return NextResponse.json({ error: "Every submission must reference current persisted Evidence" }, { status: 409 });
    }
    if (!opportunity.projectId) {
      return NextResponse.json({ error: "Canonical request task is missing" }, { status: 409 });
    }
    const proofHash = createHash("sha256")
      .update(JSON.stringify([...command.evidenceIds].sort()))
      .digest("hex");
    const settlement = await getSettlementAdapter().submitProof({
      taskId: opportunity.projectId,
      proofHash: `0x${proofHash}`,
    });
    if (settlement.status !== "proof_submitted") {
      return NextResponse.json({ error: settlement.error ?? "Evidence proof was not submitted", settlement }, { status: 409 });
    }
    await prisma.$transaction([
      prisma.discoverOpportunity.update({
        where: { id: opportunity.id },
        data: { status: "under_review", verificationStatus: "evidence_submitted" },
      }),
      prisma.discoverApplication.update({
        where: {
          opportunityId_userId: {
            opportunityId: opportunity.id,
            userId: ready.user.id,
          },
        },
        data: { status: "submitted_work", evidenceLinks: command.evidenceIds, proposal: command.note },
      }),
      prisma.task.update({
        where: { id: opportunity.projectId },
        data: { status: "proof_submitted", proofHash: `0x${proofHash}` },
      }),
      prisma.discoverOpportunityActivity.create({
        data: {
          opportunityId: opportunity.id,
          eventType: "request_work_submitted",
          actorId: ready.user.id,
          summary: "The assigned contributor submitted persisted Evidence for review.",
          metadata: json({ evidenceIds: command.evidenceIds, proofHash: `0x${proofHash}` }),
        },
      }),
    ]);
    await invalidateRequests();
    return NextResponse.json({ ok: true, status: "under_review", settlement });
  }

  if (command.action === "approve") {
    const owned = await ownerRequest(command.opportunityId, ready.user.id);
    if ("error" in owned) {
      return NextResponse.json({ error: owned.error }, { status: owned.status });
    }
    if (owned.opportunity.status !== "under_review") {
      return NextResponse.json({ error: "Submitted Evidence must be under review before approval" }, { status: 409 });
    }
    await prisma.$transaction([
      prisma.discoverOpportunity.update({
        where: { id: owned.opportunity.id },
        data: { status: "approved", verificationStatus: "requester_approved" },
      }),
      prisma.discoverOpportunityActivity.create({
        data: {
          opportunityId: owned.opportunity.id,
          eventType: "request_work_approved",
          actorId: ready.user.id,
          summary: command.note,
        },
      }),
    ]);
    await invalidateRequests();
    return NextResponse.json({ ok: true, status: "approved" });
  }

  if (command.action === "release") {
    const owned = await ownerRequest(command.opportunityId, ready.user.id);
    if ("error" in owned) {
      return NextResponse.json({ error: owned.error }, { status: owned.status });
    }
    const opportunity = owned.opportunity;
    if (opportunity.status !== "approved" || !opportunity.selectedProviderId) {
      return NextResponse.json({ error: "Approved work and an assigned provider are required before release" }, { status: 409 });
    }
    const payout = await prisma.payoutDestination.findFirst({
      where: {
        userId: opportunity.selectedProviderId,
        identityId: null,
        status: "verified",
        verifiedAt: { not: null },
        network: "ARC-TESTNET",
        asset: "USDC",
      },
      orderBy: { verifiedAt: "desc" },
    });
    if (!payout || !ARC_PROVIDER_WALLET_ADDRESS || payout.address.toLowerCase() !== ARC_PROVIDER_WALLET_ADDRESS.toLowerCase()) {
      return NextResponse.json(
        {
          error: "Release is blocked because this escrow is bound to the configured provider wallet, not the assigned contributor payout address.",
          code: "provider_payout_binding_required",
        },
        { status: 409 },
      );
    }
    const settlement = await getSettlementAdapter().release({
      taskId: opportunity.projectId!,
      reason: "requester-approved-evidence",
    });
    if (settlement.status !== "released" || !settlement.releaseTxHash) {
      return NextResponse.json({ error: settlement.error ?? "Arc release was not confirmed", settlement }, { status: 409 });
    }
    const totalUsdcMicro = BigInt(Math.round((opportunity.rewardAmountUsd ?? 0) * 1_000_000));
    const batchKey = `request-release:${opportunity.id}`;
    const publicReference = `request_${createHash("sha256").update(batchKey).digest("hex").slice(0, 24)}`;
    const receipt = await prisma.$transaction(async (tx) => {
      const batch = await tx.settlementBatch.upsert({
        where: { idempotencyKey: batchKey },
        create: {
          userId: ready.user.id,
          status: "confirmed",
          totalUsdcMicro,
          payeeCount: 1,
          idempotencyKey: batchKey,
          submittedAt: new Date(),
          confirmedAt: new Date(),
          preparedPackage: json({ type: "request_release", opportunityId: opportunity.id }),
        },
        update: {},
      });
      const chain = await tx.chainTransaction.upsert({
        where: {
          chainId_txHash: { chainId: ARC_TESTNET_CHAIN_ID, txHash: settlement.releaseTxHash! },
        },
        create: {
          settlementBatchId: batch.id,
          provider: "circle_arc_erc8183",
          providerTransactionId: settlement.jobId,
          chainId: ARC_TESTNET_CHAIN_ID,
          txHash: settlement.releaseTxHash,
          fromAddress:
            ready.profile.walletAddress ?? ARC_CLIENT_WALLET_ADDRESS ?? null,
          toAddress: payout.address,
          amountUsdcMicro: totalUsdcMicro,
          status: "confirmed",
          confirmedAt: new Date(),
        },
        update: { status: "confirmed", confirmedAt: new Date() },
      });
      return tx.receipt.upsert({
        where: { settlementBatchId: batch.id },
        create: {
          settlementBatchId: batch.id,
          chainTransactionId: chain.id,
          publicReference,
          totalUsdcMicro,
          payeeCount: 1,
          payload: json({
            type: "request_release",
            opportunityId: opportunity.id,
            taskId: opportunity.projectId,
            providerUserId: opportunity.selectedProviderId,
            evidenceRequirement: opportunity.evidenceRequirements,
            transactionHash: settlement.releaseTxHash,
          }),
        },
        update: {},
      });
    });
    await prisma.$transaction([
      prisma.task.update({
        where: { id: opportunity.projectId! },
        data: { status: "completed", settlementTxHash: settlement.releaseTxHash, recoveredUsd: opportunity.rewardAmountUsd ?? 0 },
      }),
      prisma.discoverOpportunity.update({
        where: { id: opportunity.id },
        data: { status: "confirmed", fundingStatus: "funded", verificationStatus: "settlement_confirmed" },
      }),
      prisma.discoverOpportunityActivity.create({
        data: {
          opportunityId: opportunity.id,
          eventType: "request_payment_confirmed",
          actorId: ready.user.id,
          summary: "Arc released the approved request payment and RESOLVE issued a receipt.",
          metadata: json({ receiptId: receipt.id, publicReference, txHash: settlement.releaseTxHash }),
        },
      }),
    ]);
    await invalidateRequests();
    return NextResponse.json({
      ok: true,
      status: "confirmed",
      settlement,
      receiptId: receipt.id,
      receiptUrl: canonicalOutcomeHref(publicReference),
    });
  }

  const owned = await ownerRequest(command.opportunityId, ready.user.id);
  if ("error" in owned) {
    return NextResponse.json({ error: owned.error }, { status: owned.status });
  }
  if (!["ready_to_fund", "open", "assigned"].includes(owned.opportunity.status)) {
    return NextResponse.json({ error: "This request can no longer be refunded" }, { status: 409 });
  }
  if (owned.opportunity.fundingStatus === "escrowed") {
    const settlement = await getSettlementAdapter().refund({
      taskId: owned.opportunity.projectId!,
      reason: command.reason,
    });
    if (settlement.status !== "refunded") {
      return NextResponse.json({ error: settlement.error ?? "Refund was not confirmed", settlement }, { status: 409 });
    }
  }
  await prisma.$transaction([
    prisma.task.update({ where: { id: owned.opportunity.projectId! }, data: { status: "refunded" } }),
    prisma.discoverOpportunity.update({
      where: { id: owned.opportunity.id },
      data: {
        status: owned.opportunity.fundingStatus === "escrowed" ? "refunded" : "cancelled",
        visibility: "private",
      },
    }),
    prisma.discoverOpportunityActivity.create({
      data: {
        opportunityId: owned.opportunity.id,
        eventType: owned.opportunity.fundingStatus === "escrowed" ? "request_refunded" : "request_cancelled",
        actorId: ready.user.id,
        summary: command.reason,
      },
    }),
  ]);
  await invalidateRequests();
  return NextResponse.json({ ok: true, status: owned.opportunity.fundingStatus === "escrowed" ? "refunded" : "cancelled" });
}
