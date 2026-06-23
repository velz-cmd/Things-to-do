import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  createTaskFromTemplate,
  runDeputyExecution,
} from "@/lib/deputy/orchestrator";
import { DEMO_OUTCOMES } from "@/lib/deputy/types";
import {
  getSessionUserId,
  requireReadyUser,
  assertTaskOwner,
} from "@/lib/auth/session";

export async function POST(req: Request) {
  const body = await req.json();
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const user = ready.user;
  const profile = ready.profile;

  if (body.action === "execute" && body.taskId) {
    const owned = await assertTaskOwner(body.taskId, user.id);
    if ("error" in owned) {
      return NextResponse.json({ error: owned.error }, { status: owned.status });
    }
    if (!owned.task.escrowLocked) {
      return NextResponse.json(
        { error: "Lock task budget before deploying" },
        { status: 400 }
      );
    }
    if (!owned.task.userId) {
      await prisma.task.update({
        where: { id: owned.task.id },
        data: { userId: user.id, userWallet: profile.walletAddress },
      });
    }

    void runDeputyExecution(body.taskId).catch(console.error);
    const task = await prisma.task.findUnique({
      where: { id: body.taskId },
      include: {
        events: { orderBy: { createdAt: "asc" } },
        proofs: true,
        microPayments: true,
      },
    });
    return NextResponse.json({ task });
  }

  const templateId = body.templateId as string;
  const template = DEMO_OUTCOMES.find((t) => t.id === templateId);
  if (!template) {
    return NextResponse.json({ error: "Unknown template" }, { status: 400 });
  }

  const task = await createTaskFromTemplate(template, profile.walletAddress!);
  await prisma.task.update({
    where: { id: task.id },
    data: { userId: user.id, userWallet: profile.walletAddress },
  });

  const full = await prisma.task.findUnique({
    where: { id: task.id },
    include: {
      events: { orderBy: { createdAt: "asc" } },
      proofs: true,
      microPayments: true,
    },
  });
  return NextResponse.json({ task: full });
}

export async function GET() {
  const sessionUserId = await getSessionUserId();
  if (!sessionUserId) {
    return NextResponse.json({ tasks: [] });
  }

  const tasks = await prisma.task.findMany({
    where: { userId: sessionUserId },
    orderBy: { createdAt: "desc" },
    include: {
      events: { orderBy: { createdAt: "asc" } },
      proofs: true,
      microPayments: true,
    },
  });
  return NextResponse.json({ tasks });
}
