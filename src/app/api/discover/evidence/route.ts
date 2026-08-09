import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const idsSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[A-Za-z0-9_-]+$/),
  )
  .min(1)
  .max(20);

function safePayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const payload = value as Record<string, unknown>;
  const text = (key: string) =>
    typeof payload[key] === "string" ? payload[key] : undefined;
  return {
    repository: text("repository"),
    workType: text("workType"),
    sourceKind: text("sourceKind"),
    title: text("title"),
    verificationState: text("verificationState"),
    freshness: text("freshness"),
    attributionState: text("attributionState"),
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = idsSchema.safeParse(
    (url.searchParams.get("ids") ?? "").split(",").filter(Boolean),
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        code: "INVALID_EVIDENCE_IDS",
        error: "Valid evidence identifiers are required.",
      },
      { status: 400 },
    );
  }

  let rows;
  try {
    rows = await prisma.evidence.findMany({
      where: {
        id: { in: parsed.data },
        kind: { startsWith: "github." },
        sourceUrl: { startsWith: "https://github.com/" },
      },
      orderBy: { occurredAt: "desc" },
      take: 20,
      select: {
        id: true,
        externalId: true,
        kind: true,
        subjectRef: true,
        actorRef: true,
        occurredAt: true,
        sourceUrl: true,
        payload: true,
        confidencePpm: true,
        createdAt: true,
      },
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        code: "EVIDENCE_STORAGE_UNAVAILABLE",
        error:
          "Persisted evidence is temporarily unavailable. Retry without leaving Discover.",
      },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      evidence: rows.map((row) => ({
        evidenceId: row.id,
        provider: "GitHub",
        event: row.externalId,
        kind: row.kind,
        subject: row.subjectRef,
        actor: row.actorRef?.replace(/^github:/, "") ?? null,
        acceptedAt: row.occurredAt.toISOString(),
        recordedAt: row.createdAt.toISOString(),
        sourceUrl: row.sourceUrl,
        confidencePpm: row.confidencePpm,
        ...safePayload(row.payload),
      })),
    },
    {
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
