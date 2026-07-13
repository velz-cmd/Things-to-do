import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { requireReadyUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { payeeToEntityId } from "@/lib/entity/paths";
import { appendOperationalEventInTransaction } from "@/lib/events/operational-event";
import { normalizeCommunityEvidence } from "@/lib/obligations/normalize-community";

type RouteContext = { params: Promise<{ slug: string }> };

const resolutionSchema = z.object({
  authorizationId: z.string().min(1),
  action: z.enum([
    "confirm_match",
    "reject_match",
    "request_creator_confirmation",
    "claim",
    "defer",
  ]),
  candidateRef: z.string().min(1).max(300).optional(),
  evidenceIds: z.array(z.string().min(1)).max(50).default([]),
  note: z.string().trim().max(500).optional(),
  humanConfirmed: z.boolean().default(false),
});

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function ownedAuthorization(userId: string, slug: string, authorizationId: string) {
  const install = await prisma.resolveCommunityInstall.findUnique({
    where: { userId_communitySlug: { userId, communitySlug: slug } },
    include: { programs: { select: { missionId: true } } },
  });
  if (!install) return null;
  const missionIds = install.programs.flatMap((program) => program.missionId ? [program.missionId] : []);
  if (!missionIds.length) return null;
  return prisma.paymentAuthorization.findFirst({
    where: { id: authorizationId, missionId: { in: missionIds } },
  });
}

export async function GET(_req: Request, context: RouteContext) {
  const ready = await requireReadyUser();
  if ("error" in ready) return NextResponse.json({ error: ready.error }, { status: ready.status });
  const { slug } = await context.params;
  const install = await prisma.resolveCommunityInstall.findUnique({
    where: { userId_communitySlug: { userId: ready.profile.id, communitySlug: slug } },
    include: { programs: { select: { missionId: true } } },
  });
  if (!install) return NextResponse.json({ error: "Install this community before resolving identities" }, { status: 404 });

  const missionIds = install.programs.flatMap((program) => program.missionId ? [program.missionId] : []);
  const authorizations = missionIds.length
    ? await prisma.paymentAuthorization.findMany({
        where: { missionId: { in: missionIds } },
        orderBy: { createdAt: "desc" },
        take: 100,
      })
    : [];
  const observed = await prisma.observedIdentity.findMany({
    where: { userId: ready.profile.id, communitySlug: slug },
    orderBy: { lastObservedAt: "desc" },
  });
  const observedByRef = new Map(observed.map((row) => [`${row.provider}:${row.externalRef}`, row]));
  const observedIds = observed.map((row) => row.id);
  const [candidates, resolutions, claims] = await Promise.all([
    observedIds.length ? prisma.identityCandidate.findMany({ where: { observedIdentityId: { in: observedIds } } }) : [],
    observedIds.length ? prisma.identityResolution.findMany({ where: { observedIdentityId: { in: observedIds } }, orderBy: { createdAt: "desc" } }) : [],
    observedIds.length ? prisma.identityClaim.findMany({ where: { observedIdentityId: { in: observedIds } } }) : [],
  ]);

  const rows = authorizations.map((authorization) => {
    const key = `${authorization.connectorId}:${authorization.payeeKey}`;
    const observedRow = observedByRef.get(key);
    const candidateRef = payeeToEntityId(authorization.payeeKey, authorization.payeeKeyType) ??
      `${authorization.payeeKeyType}:${authorization.payeeKey}`;
    const candidate = observedRow
      ? candidates.find((row) => row.observedIdentityId === observedRow.id && row.candidateRef === candidateRef)
      : null;
    const latestResolution = observedRow
      ? resolutions.find((row) => row.observedIdentityId === observedRow.id)
      : null;
    const claim = observedRow
      ? claims.find((row) => row.observedIdentityId === observedRow.id)
      : null;
    return {
      authorizationId: authorization.id,
      observedIdentityId: observedRow?.id ?? null,
      observedIdentity: authorization.contextLabel ?? authorization.payeeKey,
      externalRef: authorization.payeeKey,
      provider: authorization.connectorId,
      payeeKeyType: authorization.payeeKeyType,
      suggestedMatch: candidateRef,
      confidencePpm: candidate?.confidencePpm ?? Math.round(authorization.confidence * 1_000_000),
      confidenceFactors: candidate?.confidenceFactors ?? {
        exactSourceHandle: true,
        authorizationConfidence: authorization.confidence,
      },
      contradictingEvidence: candidate?.contradictingData ?? null,
      evidenceIds: [authorization.proofHash, ...(observedRow?.evidenceIds ?? [])].filter(Boolean),
      recognizedAmountUsd: authorization.amountUsd,
      payoutDestinationId: observedRow?.payoutDestinationId ?? null,
      status: observedRow?.status ?? "observed",
      candidateStatus: candidate?.status ?? "suggested",
      latestResolution: latestResolution
        ? {
            action: latestResolution.action,
            method: latestResolution.method,
            resolvedBy: latestResolution.resolvedBy,
            createdAt: latestResolution.createdAt.toISOString(),
          }
        : null,
      claimStatus: claim?.status ?? null,
    };
  });

  return NextResponse.json({ rows });
}

export async function POST(req: Request, context: RouteContext) {
  const ready = await requireReadyUser();
  if ("error" in ready) return NextResponse.json({ error: ready.error }, { status: ready.status });
  const { slug } = await context.params;
  const parsed = resolutionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid identity operation" }, { status: 400 });
  if (parsed.data.action === "confirm_match" && !parsed.data.humanConfirmed) {
    return NextResponse.json({ error: "A human must explicitly confirm financially significant identity matches" }, { status: 400 });
  }

  const authorization = await ownedAuthorization(ready.profile.id, slug, parsed.data.authorizationId);
  if (!authorization) return NextResponse.json({ error: "Identity evidence not found in this community" }, { status: 404 });

  const candidateRef = parsed.data.candidateRef ??
    payeeToEntityId(authorization.payeeKey, authorization.payeeKeyType) ??
    `${authorization.payeeKeyType}:${authorization.payeeKey}`;
  const confidencePpm = Math.max(0, Math.min(1_000_000, Math.round(authorization.confidence * 1_000_000)));
  const eventType = parsed.data.action === "confirm_match"
    ? "identity.resolved"
    : parsed.data.action === "claim"
      ? "identity.claimed"
      : `identity.${parsed.data.action}`;

  const result = await prisma.$transaction(async (tx) => {
    const observed = await tx.observedIdentity.upsert({
      where: {
        userId_communitySlug_provider_externalRef: {
          userId: ready.profile.id,
          communitySlug: slug,
          provider: authorization.connectorId,
          externalRef: authorization.payeeKey,
        },
      },
      create: {
        userId: ready.profile.id,
        communitySlug: slug,
        provider: authorization.connectorId,
        externalRef: authorization.payeeKey,
        displayLabel: authorization.contextLabel ?? authorization.payeeKey,
        evidenceIds: [authorization.proofHash, ...parsed.data.evidenceIds],
        status: "observed",
        metadata: toJson({ payeeKeyType: authorization.payeeKeyType, authorizationId: authorization.id }),
      },
      update: {
        lastObservedAt: new Date(),
        evidenceIds: [...new Set([authorization.proofHash, ...parsed.data.evidenceIds])],
      },
    });
    const previousState = observed.status;

    if (parsed.data.action === "claim") {
      const claim = await tx.identityClaim.upsert({
        where: { observedIdentityId_userId: { observedIdentityId: observed.id, userId: ready.profile.id } },
        create: {
          observedIdentityId: observed.id,
          userId: ready.profile.id,
          evidenceIds: parsed.data.evidenceIds,
          note: parsed.data.note,
        },
        update: {
          status: "submitted",
          evidenceIds: parsed.data.evidenceIds,
          note: parsed.data.note,
        },
      });
      await tx.observedIdentity.update({ where: { id: observed.id }, data: { status: "claim_pending" } });
      await appendOperationalEventInTransaction(tx, {
        eventType,
        aggregateType: "observed_identity",
        aggregateId: observed.id,
        userId: ready.profile.id,
        communitySlug: slug,
        correlationId: claim.id,
        idempotencyKey: `${eventType}:${observed.id}:${ready.profile.id}`,
        payload: toJson({ claimId: claim.id, authorizationId: authorization.id }),
      });
      return { observedIdentityId: observed.id, status: "claim_pending", claimId: claim.id };
    }

    const candidate = await tx.identityCandidate.upsert({
      where: { observedIdentityId_candidateRef: { observedIdentityId: observed.id, candidateRef } },
      create: {
        observedIdentityId: observed.id,
        candidateRef,
        displayName: authorization.contextLabel ?? authorization.payeeKey,
        confidencePpm,
        confidenceFactors: toJson({ sourceConfidence: authorization.confidence, exactSourceRef: true }),
        modelProvider: "deterministic_source_match",
        modelVersion: "1",
      },
      update: { confidencePpm },
    });

    let identityId: string | null = null;
    const newState = parsed.data.action === "confirm_match"
      ? "resolved"
      : parsed.data.action === "reject_match"
        ? "review_required"
        : parsed.data.action === "request_creator_confirmation"
          ? "awaiting_creator"
          : "deferred";
    if (parsed.data.action === "confirm_match") {
      const identity = await tx.identity.upsert({
        where: { canonicalRef: candidateRef },
        create: {
          userId: ready.profile.id,
          communitySlug: slug,
          canonicalRef: candidateRef,
          displayName: authorization.contextLabel ?? authorization.payeeKey,
          status: "verified",
          confidencePpm,
          evidenceIds: [authorization.proofHash, ...parsed.data.evidenceIds],
          verifiedAt: new Date(),
        },
        update: {
          status: "verified",
          confidencePpm,
          evidenceIds: [...new Set([authorization.proofHash, ...parsed.data.evidenceIds])],
          verifiedAt: new Date(),
        },
      });
      identityId = identity.id;
    }

    await tx.identityCandidate.update({
      where: { id: candidate.id },
      data: {
        identityId,
        status: parsed.data.action === "confirm_match" ? "confirmed" : parsed.data.action === "reject_match" ? "rejected" : "suggested",
      },
    });
    await tx.observedIdentity.update({ where: { id: observed.id }, data: { status: newState } });
    const resolution = await tx.identityResolution.create({
      data: {
        observedIdentityId: observed.id,
        candidateId: candidate.id,
        identityId,
        action: parsed.data.action,
        method: "human_review",
        resolvedBy: ready.profile.id,
        evidenceIds: [authorization.proofHash, ...parsed.data.evidenceIds],
        previousState,
        newState,
        modelProvider: candidate.modelProvider,
        modelVersion: candidate.modelVersion,
        note: parsed.data.note,
      },
    });
    await appendOperationalEventInTransaction(tx, {
      eventType,
      aggregateType: "observed_identity",
      aggregateId: observed.id,
      userId: ready.profile.id,
      communitySlug: slug,
      correlationId: resolution.id,
      idempotencyKey: `${eventType}:${observed.id}:${resolution.id}`,
      payload: toJson({
        resolutionId: resolution.id,
        candidateId: candidate.id,
        identityId,
        previousState,
        newState,
        evidenceIds: resolution.evidenceIds,
      }),
    });
    return { observedIdentityId: observed.id, identityId, resolutionId: resolution.id, status: newState };
  });

  await normalizeCommunityEvidence({
    userId: ready.profile.id,
    communitySlug: slug,
    provider: authorization.connectorId,
  }).catch(() => null);

  return NextResponse.json({ ok: true, result });
}
