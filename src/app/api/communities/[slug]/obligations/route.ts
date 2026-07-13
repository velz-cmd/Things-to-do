import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { requireReadyUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { appendOperationalEventInTransaction } from "@/lib/events/operational-event";
import { formatUsdcTokenUnits } from "@/lib/money/usdc";

type RouteContext = { params: Promise<{ slug: string }> };
const reviewSchema = z.object({ obligationId: z.string().min(1), action: z.literal("review") });

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function parseJson(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try { return JSON.parse(value) as Record<string, unknown>; } catch { return {}; }
}

export async function GET(_req: Request, context: RouteContext) {
  const ready = await requireReadyUser();
  if ("error" in ready) return NextResponse.json({ error: ready.error }, { status: ready.status });
  const { slug } = await context.params;
  const install = await prisma.resolveCommunityInstall.findUnique({
    where: { userId_communitySlug: { userId: ready.profile.id, communitySlug: slug } },
    include: { programs: { select: { id: true, name: true, missionId: true } } },
  });
  if (!install) return NextResponse.json({ error: "Community not installed" }, { status: 404 });

  const obligations = await prisma.obligation.findMany({
    where: { userId: ready.profile.id, communitySlug: slug },
    orderBy: { recognizedAt: "desc" },
    take: 250,
  });
  if (obligations.length) {
    const programVersions = await prisma.programVersion.findMany({
      where: { id: { in: [...new Set(obligations.map((row) => row.programVersionId))] } },
    });
    const policies = await prisma.policyVersion.findMany({
      where: { id: { in: [...new Set(obligations.map((row) => row.policyVersionId))] } },
    });
    const evidence = await prisma.evidence.findMany({
      where: { id: { in: [...new Set(obligations.flatMap((row) => row.evidenceIds))] } },
      select: { id: true, kind: true, subjectRef: true, actorRef: true, occurredAt: true, contentHash: true, sourceUrl: true, confidencePpm: true },
    });
    const identities = await prisma.identity.findMany({
      where: { id: { in: obligations.flatMap((row) => row.identityId ? [row.identityId] : []) } },
      select: { id: true, displayName: true, canonicalRef: true, status: true },
    });
    const destinations = await prisma.payoutDestination.findMany({
      where: { id: { in: obligations.flatMap((row) => row.payoutDestinationId ? [row.payoutDestinationId] : []) } },
      select: { id: true, network: true, address: true, status: true },
    });
    const rows = obligations.map((obligation) => {
      const programVersion = programVersions.find((row) => row.id === obligation.programVersionId);
      const snapshot = (programVersion?.snapshot ?? {}) as Record<string, unknown>;
      const policy = policies.find((row) => row.id === obligation.policyVersionId);
      const identity = identities.find((row) => row.id === obligation.identityId);
      const payout = destinations.find((row) => row.id === obligation.payoutDestinationId);
      const evidenceRows = evidence.filter((row) => obligation.evidenceIds.includes(row.id));
      return {
        id: obligation.id,
        payee: identity?.displayName ?? evidenceRows[0]?.actorRef ?? "Unresolved source identity",
        amountUsd: formatUsdcTokenUnits(obligation.amountUsdcMicro),
        status: obligation.status,
        blockerCode: obligation.blockerCode,
        program: { id: String(snapshot.programId ?? programVersion?.programId ?? ""), name: String(snapshot.name ?? "Operational program"), version: programVersion?.version ?? 1 },
        policy: policy ? { id: policy.id, version: policy.version, contentHash: policy.contentHash } : null,
        identity: identity ? { id: identity.id, canonicalRef: identity.canonicalRef, status: identity.status } : null,
        payout: payout ? { id: payout.id, network: payout.network, address: `${payout.address.slice(0, 8)}…${payout.address.slice(-6)}`, status: payout.status } : null,
        evidence: evidenceRows.map((row) => ({ ...row, occurredAt: row.occurredAt.toISOString() })),
        lineageHash: obligation.lineageHash,
        settlementBatchId: obligation.settlementBatchId,
        recognizedAt: obligation.recognizedAt.toISOString(),
      };
    });
    return NextResponse.json({ rows, normalized: true });
  }

  const missionIds = install.programs.flatMap((program) => program.missionId ? [program.missionId] : []);
  const authorizations = missionIds.length ? await prisma.paymentAuthorization.findMany({ where: { missionId: { in: missionIds } }, orderBy: { createdAt: "desc" }, take: 250 }) : [];
  return NextResponse.json({
    normalized: false,
    rows: authorizations.map((authorization) => {
      const program = install.programs.find((row) => row.missionId === authorization.missionId);
      const evidence = parseJson(authorization.evidenceJson);
      return {
        id: authorization.id,
        payee: authorization.contextLabel ?? authorization.payeeKey,
        amountUsd: authorization.amountUsd.toFixed(6),
        status: authorization.status,
        blockerCode: authorization.walletAddress ? null : "identity_or_payout_unresolved",
        program: { id: program?.id ?? "", name: program?.name ?? "Legacy program", version: 0 },
        policy: null,
        identity: authorization.walletAddress ? { id: authorization.payeeKey, canonicalRef: authorization.payeeKey, status: "wallet_linked" } : null,
        payout: authorization.walletAddress ? { id: "legacy", network: "eip155:5042002", address: `${authorization.walletAddress.slice(0, 8)}…${authorization.walletAddress.slice(-6)}`, status: "linked" } : null,
        evidence: [{ id: authorization.id, kind: authorization.eventType, subjectRef: authorization.missionId, actorRef: authorization.payeeKey, occurredAt: authorization.createdAt.toISOString(), contentHash: authorization.proofHash, sourceUrl: typeof evidence.sourceUrl === "string" ? evidence.sourceUrl : null, confidencePpm: Math.round(authorization.confidence * 1_000_000) }],
        lineageHash: authorization.proofHash,
        settlementBatchId: authorization.settlementId,
        recognizedAt: authorization.createdAt.toISOString(),
      };
    }),
  });
}

export async function POST(req: Request, context: RouteContext) {
  const ready = await requireReadyUser();
  if ("error" in ready) return NextResponse.json({ error: ready.error }, { status: ready.status });
  const { slug } = await context.params;
  const parsed = reviewSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid obligation review" }, { status: 400 });
  const obligation = await prisma.obligation.findFirst({ where: { id: parsed.data.obligationId, userId: ready.profile.id, communitySlug: slug } });
  if (!obligation) return NextResponse.json({ error: "Normalized obligation not found; synchronize the source before review" }, { status: 404 });
  const nextStatus = obligation.identityId && obligation.payoutDestinationId ? "ready_for_simulation" : "needs_identity";
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.obligation.update({ where: { id: obligation.id }, data: { status: nextStatus } });
    await appendOperationalEventInTransaction(tx, {
      eventType: "obligation.reviewed",
      aggregateType: "obligation",
      aggregateId: obligation.id,
      userId: ready.profile.id,
      communitySlug: slug,
      correlationId: obligation.id,
      idempotencyKey: `obligation-reviewed:${obligation.id}:${obligation.lineageHash}`,
      payload: toJson({ previousState: obligation.status, newState: nextStatus, policyVersionId: obligation.policyVersionId, evidenceIds: obligation.evidenceIds }),
    });
    return row;
  });
  return NextResponse.json({ ok: true, status: updated.status });
}
