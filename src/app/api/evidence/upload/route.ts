import { NextResponse } from "next/server";
import { requireReadyUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import {
  ALLOWED_EVIDENCE_TYPES,
  MAX_EVIDENCE_BYTES,
  storeEvidenceFile,
  extractTextFromFile,
} from "@/lib/evidence/evidence-service";

export async function POST(req: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const taskId = (form.get("taskId") as string) || undefined;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_EVIDENCE_BYTES) {
    return NextResponse.json(
      { error: `File too large. Max ${MAX_EVIDENCE_BYTES / 1024 / 1024}MB` },
      { status: 400 }
    );
  }

  const fileType = file.type || "application/octet-stream";
  if (!ALLOWED_EVIDENCE_TYPES.has(fileType)) {
    return NextResponse.json(
      { error: `File type not supported: ${fileType}` },
      { status: 400 }
    );
  }

  if (taskId) {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task || (task.userId && task.userId !== ready.user.id)) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { storagePath, hash } = await storeEvidenceFile(
    ready.user.id,
    file.name,
    fileType,
    buffer
  );

  const row = await prisma.evidenceFile.create({
    data: {
      userId: ready.user.id,
      taskId: taskId ?? null,
      fileName: file.name,
      fileType,
      fileSize: file.size,
      storagePath,
      hash,
      status: "uploaded",
    },
  });

  // Async-style extraction (inline for simplicity)
  const extracted = await extractTextFromFile(fileType, buffer);
  if (extracted) {
    await prisma.evidenceFile.update({
      where: { id: row.id },
      data: { status: "candidate", extractedText: extracted },
    });
  } else {
    await prisma.evidenceFile.update({
      where: { id: row.id },
      data: { status: "candidate" },
    });
  }

  const updated = await prisma.evidenceFile.findUnique({ where: { id: row.id } });

  return NextResponse.json({
    file: formatEvidence(updated!),
    message: "File received — evidence candidate created. Needs verification.",
  });
}

function formatEvidence(row: {
  id: string;
  taskId: string | null;
  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
  hash: string;
  status: string;
  extractedText: string | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    taskId: row.taskId ?? undefined,
    fileName: row.fileName,
    fileType: row.fileType,
    fileSize: row.fileSize,
    storagePath: row.storagePath,
    hash: row.hash,
    status: row.status,
    extractedText: row.extractedText ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}
