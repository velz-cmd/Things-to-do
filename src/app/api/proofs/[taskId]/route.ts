import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth/session";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  const sessionUserId = await getSessionUserId();

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (task.userId && sessionUserId && task.userId !== sessionUserId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const proofs = await prisma.proof.findMany({
    where: { taskId },
    orderBy: { createdAt: "desc" },
  });

  const browserProofs = await prisma.browserProof.findMany({
    where: { taskId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ proofs, browserProofs });
}
