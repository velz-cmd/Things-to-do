import { NextResponse } from "next/server";
import { requireReadyUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import {
  deleteEvidenceFile,
  readEvidenceFile,
  extractTextFromFile,
  evidenceTypeLabel,
} from "@/lib/evidence/evidence-service";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const { id } = await params;
  const file = await prisma.evidenceFile.findUnique({ where: { id } });
  if (!file || file.userId !== ready.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await deleteEvidenceFile(file.storagePath);
  await prisma.evidenceFile.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = (body as { action?: string }).action ?? "use";

  const file = await prisma.evidenceFile.findUnique({ where: { id } });
  if (!file || file.userId !== ready.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (action === "extract") {
    const buf = await readEvidenceFile(file.storagePath);
    const extracted = await extractTextFromFile(file.fileType, buf);
    await prisma.evidenceFile.update({
      where: { id },
      data: {
        status: "candidate",
        extractedText: extracted ?? "Binary file — manual review required",
      },
    });
    return NextResponse.json({ ok: true, status: "candidate" });
  }

  // action === "use" — attach to task as unverified proof candidate
  const taskId = (body as { taskId?: string }).taskId;
  if (!taskId) {
    return NextResponse.json({ error: "taskId required" }, { status: 400 });
  }

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || (task.userId && task.userId !== ready.user.id)) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  await prisma.evidenceFile.update({
    where: { id },
    data: { taskId, status: "candidate" },
  });

  const proofType = evidenceTypeLabel(file.fileType);
  const contentHash = file.hash;
  await prisma.proof.create({
    data: {
      taskId,
      type: proofType,
      source: `upload:${file.fileName}`,
      payload: JSON.stringify({
        fileName: file.fileName,
        fileType: file.fileType,
        hash: file.hash,
        status: "candidate",
      }),
      contentHash,
      verified: false,
    },
  });

  return NextResponse.json({
    ok: true,
    message: "Evidence candidate created — needs verification",
    status: "candidate",
  });
}
