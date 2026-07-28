import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireReadyUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { resolveCommunityForRepo } from "@/lib/discover/repo-community";
import { createStructuredMission } from "@/lib/mission/server/structured-engine";

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
  const actionKey = `discover.start_structured_mission:v2:${ready.user.id}:${parsed.data.repository.toLowerCase()}:${parsed.data.fingerprint}`;
  const existing = await prisma.actionRun.findUnique({ where: { idempotencyKey: actionKey } });
  const existingOutput = existing?.output && typeof existing.output === "object"
    ? existing.output as { missionId?: string; href?: string }
    : null;
  if (existingOutput?.missionId && existingOutput.href) {
    return NextResponse.json({ ok: true, replayed: true, ...existingOutput });
  }

  const workflow = await createStructuredMission(ready.user.id, {
    kind: "investigate",
    objective: parsed.data.objective,
    constraints: [
      "Use only persisted repository evidence.",
      "Disclose missing identity, policy, and payout evidence.",
    ],
    sources: [{
      type: "connected_repository",
      ref: parsed.data.repository,
      label: `${parsed.data.repository} snapshot ${parsed.data.fingerprint.slice(0, 12)}`,
    }],
  });
  const href = `/mission?id=${encodeURIComponent(workflow.mission.id)}`;
  let auditPersisted = true;
  const result = { missionId: workflow.mission.id, href };
  try {
    await prisma.$transaction(async (tx) => {
    const output = { missionId: workflow.mission.id, href };
    await tx.actionRun.create({
      data: {
        userId: ready.user.id,
        actionId: "discover.start_mission",
        aggregateType: "ResolveMission",
        aggregateId: workflow.mission.id,
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
        aggregateId: workflow.mission.id,
        userId: ready.user.id,
        communitySlug,
        correlationId: request.headers.get("x-correlation-id") ?? randomUUID(),
        idempotencyKey: `event:${actionKey}`,
        payload: output,
      },
    });
    }, { maxWait: 5_000, timeout: 15_000 });
  } catch (error) {
    auditPersisted = false;
    console.error("[discover] structured Mission audit failed", error);
  }

  return NextResponse.json({ ok: true, replayed: false, auditPersisted, ...result });
}
