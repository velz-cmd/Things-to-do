import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  createTaskFromTemplate,
  runDeputyExecution,
} from "@/lib/deputy/orchestrator";
import { DEMO_OUTCOMES } from "@/lib/deputy/types";
import { getSessionUserId } from "@/lib/wallet/service";

export async function POST(req: Request) {
  const body = await req.json();
  const sessionUserId = await getSessionUserId();

  if (body.action === "execute" && body.taskId) {
    void runDeputyExecution(body.taskId).catch(console.error);
    const task = await prisma.task.findUnique({ where: { id: body.taskId } });
    return NextResponse.json({ task });
  }

  const templateId = body.templateId as string;
  const userWallet = body.userWallet as string | undefined;

  const template = DEMO_OUTCOMES.find((t) => t.id === templateId);
  if (!template) {
    return NextResponse.json({ error: "Unknown template" }, { status: 400 });
  }

  const task = await createTaskFromTemplate(template, userWallet);
  if (sessionUserId) {
    await prisma.task.update({
      where: { id: task.id },
      data: { userId: sessionUserId },
    });
  }

  const deferExecution = body.deferExecution as boolean | undefined;
  if (!deferExecution) {
    void runDeputyExecution(task.id).catch(console.error);
  }

  const full = await prisma.task.findUnique({ where: { id: task.id } });
  return NextResponse.json({ task: full });
}

export async function GET() {
  const tasks = await prisma.task.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      events: { orderBy: { createdAt: "asc" } },
      proofs: true,
      microPayments: true,
    },
  });
  return NextResponse.json({ tasks });
}
