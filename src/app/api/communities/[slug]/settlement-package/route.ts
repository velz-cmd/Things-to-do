import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { isAddress } from "viem";
import { requireReadyUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { appendOperationalEventInTransaction } from "@/lib/events/operational-event";
import { compileSettlementPackage, hashCanonicalSettlementValue } from "@/lib/settlement/settlement-package";
import { formatUsdcTokenUnits } from "@/lib/money/usdc";

type RouteContext = { params: Promise<{ slug: string }> };
const requestSchema = z.object({
  programId: z.string().trim().min(1).optional(),
  returnTo: z.string().trim().startsWith("/").optional(),
});

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function POST(req: Request, context: RouteContext) {
  const ready = await requireReadyUser();
  if ("error" in ready) return NextResponse.json({ error: ready.error }, { status: ready.status });
  const { slug } = await context.params;
  const parsed = requestSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid settlement-package request" }, { status: 400 });

  const install = await prisma.resolveCommunityInstall.findUnique({
    where: { userId_communitySlug: { userId: ready.profile.id, communitySlug: slug } },
    include: { programs: { orderBy: { updatedAt: "desc" } } },
  });
  if (!install) return NextResponse.json({ error: "Community not installed" }, { status: 404 });
  const program = parsed.data.programId
    ? install.programs.find((row) => row.id === parsed.data.programId)
    : install.programs[0];
  if (!program) return NextResponse.json({ error: "Create a program before preparing settlement" }, { status: 409 });

  const programVersion = await prisma.programVersion.findFirst({
    where: { programId: program.id },
    orderBy: { version: "desc" },
  });
  if (!programVersion) return NextResponse.json({ error: "The program has no immutable version" }, { status: 409 });
  const policyVersion = await prisma.policyVersion.findFirst({
    where: { programVersionId: programVersion.id },
    orderBy: { version: "desc" },
  });
  if (!policyVersion) return NextResponse.json({ error: "The program has no versioned policy" }, { status: 409 });

  const obligations = await prisma.obligation.findMany({
    where: {
      userId: ready.profile.id,
      communitySlug: slug,
      programVersionId: programVersion.id,
      policyVersionId: policyVersion.id,
      status: { notIn: ["settled", "claimed", "rejected"] },
    },
    orderBy: { id: "asc" },
  });
  if (!obligations.length) {
    return NextResponse.json({ error: "No normalized obligations are ready for this policy version" }, { status: 409 });
  }
  const blocked = obligations.find((row) => !row.identityId || !row.payoutDestinationId || row.blockerCode);
  if (blocked) {
    return NextResponse.json({
      error: "Resolve every payee identity and verified payout destination before settlement",
      blocker: blocked.blockerCode ?? "identity_or_payout_unresolved",
      obligationId: blocked.id,
    }, { status: 409 });
  }

  const blueprint = await prisma.blueprint.findFirst({
    where: {
      userId: ready.profile.id,
      communitySlug: slug,
      OR: [{ programId: program.id }, { programId: null }],
    },
    orderBy: { updatedAt: "desc" },
  });
  const simulation = blueprint ? await prisma.simulation.findFirst({
    where: { blueprintId: blueprint.id, status: "completed" },
    orderBy: { version: "desc" },
  }) : null;
  if (!simulation) {
    return NextResponse.json({ error: "Run and persist a Mission simulation before settlement" }, { status: 409 });
  }

  const payoutIds = obligations.flatMap((row) => row.payoutDestinationId ? [row.payoutDestinationId] : []);
  const destinations = await prisma.payoutDestination.findMany({
    where: { id: { in: payoutIds }, status: "verified" },
  });
  if (destinations.length !== obligations.length) {
    return NextResponse.json({ error: "Every payee needs a currently verified payout destination" }, { status: 409 });
  }
  if (destinations.some((destination) => !isAddress(destination.address))) {
    return NextResponse.json({ error: "A verified payout destination is not a valid Arc address" }, { status: 409 });
  }
  const evidenceIds = [...new Set(obligations.flatMap((row) => row.evidenceIds))];
  const evidence = await prisma.evidence.findMany({
    where: { id: { in: evidenceIds }, communitySlug: slug },
    select: { id: true, contentHash: true },
  });
  if (evidence.length !== evidenceIds.length) {
    return NextResponse.json({ error: "The evidence lineage is incomplete; synchronize the source again" }, { status: 409 });
  }

  const preparedAt = new Date().toISOString();
  const compiled = compileSettlementPackage({
    communityId: slug,
    programId: program.id,
    programVersionId: programVersion.id,
    policyVersionId: policyVersion.id,
    payees: obligations.map((obligation) => {
      const payout = destinations.find((row) => row.id === obligation.payoutDestinationId)!;
      return {
        obligationId: obligation.id,
        identityId: obligation.identityId!,
        payoutDestinationId: payout.id,
        address: payout.address,
        amountUsdcMicro: obligation.amountUsdcMicro.toString(),
        evidenceIds: obligation.evidenceIds,
      };
    }),
    evidenceContentHashes: evidence.map((row) => row.contentHash),
    simulationId: simulation.id,
    preparedAt,
  });
  const idempotencyKey = `settlement-package:${hashCanonicalSettlementValue({
    communityId: slug,
    programId: program.id,
    policyVersionId: policyVersion.id,
    obligationIds: compiled.package.obligationIds,
    simulationId: simulation.id,
  })}`;

  const batch = await prisma.$transaction(async (tx) => {
    const existing = await tx.settlementBatch.findUnique({ where: { idempotencyKey } });
    if (existing) return existing;
    const created = await tx.settlementBatch.create({
      data: {
        userId: ready.profile.id,
        communitySlug: slug,
        status: "prepared",
        totalUsdcMicro: BigInt(compiled.package.totalUsdcMicro),
        payeeCount: compiled.package.payees.length,
        idempotencyKey,
        simulationId: simulation.id,
        preparedPackage: toJson({ ...compiled.package, packageHash: compiled.packageHash }),
      },
    });
    await tx.obligation.updateMany({
      where: { id: { in: compiled.package.obligationIds }, userId: ready.profile.id },
      data: { status: "authorization_pending", settlementBatchId: created.id },
    });
    await appendOperationalEventInTransaction(tx, {
      eventType: "settlement.package_prepared",
      aggregateType: "settlement_batch",
      aggregateId: created.id,
      userId: ready.profile.id,
      communitySlug: slug,
      correlationId: created.id,
      idempotencyKey: `settlement-package-event:${created.id}`,
      payload: toJson({ settlementBatchId: created.id, programId: program.id, policyVersionId: policyVersion.id, simulationId: simulation.id, packageHash: compiled.packageHash, totalUsdcMicro: compiled.package.totalUsdcMicro, payeeCount: compiled.package.payees.length }),
    });
    return created;
  });

  const returnTo = parsed.data.returnTo ?? `/communities/${encodeURIComponent(slug)}?tab=console`;
  const capitalUrl = `/capital?community=${encodeURIComponent(slug)}&program=${encodeURIComponent(program.id)}&settlementBatch=${encodeURIComponent(batch.id)}&returnTo=${encodeURIComponent(returnTo)}`;
  return NextResponse.json({
    ok: true,
    settlementBatchId: batch.id,
    packageHash: (batch.preparedPackage as Record<string, unknown>).packageHash,
    totalUsd: formatUsdcTokenUnits(batch.totalUsdcMicro),
    payeeCount: batch.payeeCount,
    capitalUrl,
  });
}
