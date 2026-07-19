import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireReadyUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { refreshOssRepositoryStore } from "@/lib/github/oss-scan-store";

const repositoryPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const requestSchema = z.object({
  repository: z.string().trim().min(3).max(200).regex(repositoryPattern),
});

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

export async function POST(request: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ ok: false, code: "AUTH_REQUIRED", error: ready.error }, { status: ready.status });
  }
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, code: "INVALID_REPOSITORY", error: "Enter a public GitHub repository as owner/repository." },
      { status: 400 },
    );
  }

  const [owner, repo] = parsed.data.repository.split("/") as [string, string];
  let result: Awaited<ReturnType<typeof refreshOssRepositoryStore>>;
  try {
    result = await refreshOssRepositoryStore(owner, repo);
  } catch {
    return NextResponse.json(
      { ok: false, persisted: false, code: "SNAPSHOT_PERSISTENCE_FAILED", error: "The repository was reachable, but its verified snapshot could not be persisted. No Discover snapshot was saved." },
      { status: 503 },
    );
  }
  if (!result) {
    return NextResponse.json(
      { ok: false, code: "REPOSITORY_UNAVAILABLE", error: "GitHub did not return a public repository snapshot. Confirm the name and retry." },
      { status: 404 },
    );
  }

  const actionKey = `discover.capture_repository_snapshot:${ready.user.id}:${result.opportunity.fullName.toLowerCase()}:${result.fingerprint}`;
  const sourceConnection = await prisma.sourceConnection.findFirst({
    where: {
      userId: ready.user.id,
      provider: "github",
      status: { in: ["connected", "healthy", "syncing", "stale"] },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  }).catch(() => null);
  const proofEvents = [
    ...(result.opportunity.activity?.records ?? []).map((record) => ({
      sourceConnectionId: sourceConnection?.id ?? null,
      communitySlug: null,
      externalId: record.id,
      kind: `github.${record.sourceKind}.${record.category}`,
      subjectRef: `github:${result.opportunity.fullName.toLowerCase()}`,
      actorRef: `github:${record.actor.toLowerCase()}`,
      occurredAt: new Date(record.occurredAt),
      contentHash: createHash("sha256").update(JSON.stringify({
        snapshot: result.fingerprint,
        id: record.id,
        category: record.category,
        actor: record.actor.toLowerCase(),
        occurredAt: record.occurredAt,
      })).digest("hex"),
      sourceUrl: record.sourceUrl,
      payload: json({
        repository: result.opportunity.fullName,
        workType: record.category,
        sourceKind: record.sourceKind,
        title: record.title,
        snapshotId: result.fingerprint,
        verificationState: "verified_source",
        freshness: result.observedAt,
        attributionState: "observed",
      }),
      confidencePpm: 1_000_000,
    })),
    ...(result.opportunity.dependencies ?? []).map((dependency) => ({
      sourceConnectionId: sourceConnection?.id ?? null,
      communitySlug: null,
      externalId: `dependency:${result.opportunity.fullName}:${dependency.name}`,
      kind: "github.dependency.detected",
      subjectRef: `github:${result.opportunity.fullName.toLowerCase()}`,
      actorRef: null,
      occurredAt: new Date(result.observedAt),
      contentHash: createHash("sha256").update(JSON.stringify({
        snapshot: result.fingerprint,
        name: dependency.name,
        requirement: dependency.requirement,
        manifestPath: dependency.manifestPath,
      })).digest("hex"),
      sourceUrl: dependency.sourceUrl,
      payload: json({
        repository: result.opportunity.fullName,
        dependency: dependency.name,
        requirement: dependency.requirement,
        dependencyKind: dependency.kind,
        manifestPath: dependency.manifestPath,
        snapshotId: result.fingerprint,
        verificationState: "verified_source",
        freshness: result.observedAt,
        attributionState: "maintainer_unresolved",
      }),
      confidencePpm: 1_000_000,
    })),
  ];
  const output = {
    repository: result.opportunity.fullName,
    fingerprint: result.fingerprint,
    observedAt: result.observedAt,
    persisted: true,
    proofEventCount: proofEvents.length,
  };
  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.actionRun.findUnique({ where: { idempotencyKey: actionKey } });
      if (existing) return;
      await tx.actionRun.create({
        data: {
          userId: ready.user.id,
          actionId: "discover.capture_repository_snapshot",
          aggregateType: "DiscoverRepositorySnapshot",
          aggregateId: result.fingerprint,
          idempotencyKey: actionKey,
          state: "completed",
          recommendationReason: "The user requested a current, persisted GitHub contribution snapshot.",
          input: json({ repository: result.opportunity.fullName }),
          output: json(output),
          completedAt: new Date(),
        },
      });
      if (proofEvents.length) {
        await tx.evidence.createMany({ data: proofEvents, skipDuplicates: true });
      }
      await tx.operationalEvent.create({
        data: {
          eventType: "discover.repository_snapshot_captured",
          aggregateType: "DiscoverRepositorySnapshot",
          aggregateId: result.fingerprint,
          userId: ready.user.id,
          communitySlug: null,
          correlationId: request.headers.get("x-correlation-id") ?? randomUUID(),
          idempotencyKey: `event:${actionKey}`,
          payload: json(output),
        },
      });
    });
  } catch {
    return NextResponse.json(
      { ok: false, persisted: true, code: "SNAPSHOT_AUDIT_FAILED", error: "The repository snapshot was persisted, but its action audit record could not be completed. Refresh Discover before retrying." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, ...output });
}
