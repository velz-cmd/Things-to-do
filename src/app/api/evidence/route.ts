import { NextResponse } from "next/server";
import { requireReadyUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const taskId = new URL(req.url).searchParams.get("taskId") ?? undefined;

  const files = await prisma.evidenceFile.findMany({
    where: {
      userId: ready.user.id,
      ...(taskId ? { OR: [{ taskId }, { taskId: null }] } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    files: files.map((f) => ({
      id: f.id,
      taskId: f.taskId ?? undefined,
      fileName: f.fileName,
      fileType: f.fileType,
      fileSize: f.fileSize,
      hash: f.hash,
      status: f.status,
      extractedText: f.extractedText ?? undefined,
      createdAt: f.createdAt.toISOString(),
    })),
  });
}
