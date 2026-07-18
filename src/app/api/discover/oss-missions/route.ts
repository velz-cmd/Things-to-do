import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireReadyUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { resolveCommunityForRepo } from "@/lib/discover/repo-community";

const repositoryPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const schema = z.object({
  repository: z.string().trim().regex(repositoryPattern),
  fingerprint: z.string().length(64),
  objective: z.string().trim().min(12).max(500),
  evidenceIds: z.array(z.string().min(1).max(300)).max(50).default([]),
  returnTo: z.string().startsWith("/").max(500),
});

export async function POST(request: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ ok: false, code: "AUTH_REQUIRED", error: ready.error }, { status: ready.status });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.returnTo.startsWith("//")) {
    return NextResponse.json({ ok: false, code: "INVALID_CONTEXT", error: "The repository mission context is incomplete." }, { status: 400 });
  }
  const snapshot = await prisma.discoverRepositorySnapshot.findUnique({
    where: {
      fullName_fingerprint: {
        fullName: parsed.data.repository,
        fingerprint: parsed.data.fingerprint,
      },
    },
  });
  if (!snapshot) {
    return NextResponse.json(
      { ok: false, code: "SNAPSHOT_REQUIRED", error: "Capture a verified repository snapshot before opening Mission." },
      { status: 409 },
    );
  }

  const payload = snapshot.payload && typeof snapshot.payload === "object" && !Array.isArray(snapshot.payload)
    ? snapshot.payload as { activity?: { records?: Array<{ id?: string }> } }
    : {};
  const snapshotEvidenceIds = new Set(
    (payload.activity?.records ?? []).flatMap((record) => typeof record.id === "string" ? [record.id] : []),
  );
  const unknownEvidenceIds = parsed.data.evidenceIds.filter((id) => !snapshotEvidenceIds.has(id));
  if (unknownEvidenceIds.length) {
    const normalizedEvidence = await prisma.evidence.findMany({
      where: {
        id: { in: unknownEvidenceIds },
        OR: [
          { subjectRef: { contains: parsed.data.repository, mode: "insensitive" } },
          { sourceUrl: { contains: `github.com/${parsed.data.repository}`, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    const validNormalizedIds = new Set(normalizedEvidence.map((item) => item.id));
    if (unknownEvidenceIds.some((id) => !validNormalizedIds.has(id))) {
      return NextResponse.json({ ok: false, code: "INVALID_EVIDENCE", error: "One or more evidence records do not belong to this repository snapshot." }, { status: 400 });
    }
  }

  const [owner, repo] = parsed.data.repository.split("/") as [string, string];
  const { communitySlug } = resolveCommunityForRepo(owner, repo);
  const actionKey = `discover.start_mission:${ready.user.id}:${parsed.data.repository.toLowerCase()}:${parsed.data.fingerprint}`;
  const existing = await prisma.actionRun.findUnique({ where: { idempotencyKey: actionKey } });
  const existingOutput = existing?.output && typeof existing.output === "object"
    ? existing.output as { missionId?: string; destination?: string }
    : null;
  if (existingOutput?.missionId && existingOutput.destination) {
    return NextResponse.json({ ok: true, replayed: true, ...existingOutput });
  }

  const result = await prisma.$transaction(async (tx) => {
    const mission = await tx.resolveMission.create({
      data: {
        userId: ready.user.id,
        title: `Funding intelligence: ${parsed.data.repository}`,
        scope: parsed.data.repository,
        status: "created",
        capability: "open_source_funding_intelligence",
        phase: "signal",
        metadataJson: JSON.stringify({
          source: "discover",
          repository: parsed.data.repository,
          snapshotFingerprint: parsed.data.fingerprint,
          snapshotObservedAt: snapshot.observedAt.toISOString(),
          objective: parsed.data.objective,
          evidenceIds: parsed.data.evidenceIds,
          returnTo: parsed.data.returnTo,
        }),
      },
    });
    const destination = `/mission?mission=${encodeURIComponent(mission.id)}`;
    const output = { missionId: mission.id, destination };
    await tx.actionRun.create({
      data: {
        userId: ready.user.id,
        actionId: "discover.start_mission",
        aggregateType: "ResolveMission",
        aggregateId: mission.id,
        idempotencyKey: actionKey,
        state: "completed",
        recommendationReason: "The repository snapshot has uncovered work or funding decisions that require Mission analysis.",
        input: { repository: parsed.data.repository, fingerprint: parsed.data.fingerprint, objective: parsed.data.objective, evidenceIds: parsed.data.evidenceIds },
        output,
        completedAt: new Date(),
      },
    });
    await tx.operationalEvent.create({
      data: {
        eventType: "discover.mission_started",
        aggregateType: "ResolveMission",
        aggregateId: mission.id,
        userId: ready.user.id,
        communitySlug,
        correlationId: request.headers.get("x-correlation-id") ?? randomUUID(),
        idempotencyKey: `event:${actionKey}`,
        payload: output,
      },
    });
    return output;
  });

  return NextResponse.json({ ok: true, replayed: false, ...result });
}
