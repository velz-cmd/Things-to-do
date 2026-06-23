import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSessionUser } from "@/lib/auth/session";
import { browserExecutor } from "@/lib/browser/browser-executor";
import { recipeForTask } from "@/lib/browser/browser-recipes";
import { prisma } from "@/lib/db";
import type { BrowserApiResponse } from "@/lib/browser/browser-types";

const runSchema = z.object({
  taskId: z.string(),
  userApprovedFinalSubmit: z.boolean().optional(),
});

export async function POST(req: Request) {
  const session = await requireSessionUser();
  if ("error" in session) {
    return NextResponse.json({ ok: false, error: session.error }, { status: session.status });
  }

  const body = await req.json();
  const parsed = runSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const task = await prisma.task.findUnique({
    where: { id: parsed.data.taskId },
    include: { user: true },
  });
  if (!task || task.userId !== session.user.id) {
    return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
  }

  const email =
    task.user?.email ?? `resolve+${task.id.slice(0, 8)}@demo.resolve.app`;

  const input = recipeForTask({
    taskId: task.id,
    category: task.category,
    merchantId: task.merchantId,
    email,
    targetValueUsd: task.targetValueUsd,
    userApprovedFinalSubmit: parsed.data.userApprovedFinalSubmit,
  });

  if (!input) {
    return NextResponse.json(
      { ok: false, error: "No browser recipe for this task category" },
      { status: 400 }
    );
  }

  const result = await browserExecutor.run(input, async (label, metadata) => {
    await prisma.taskEvent.create({
      data: {
        taskId: task.id,
        agent: "Executor",
        phase: "browser",
        message: label,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
  });

  const response: BrowserApiResponse = {
    ok: result.success,
    result,
    message: result.success
      ? "Browser workflow completed"
      : "Browser workflow completed with errors",
    error: result.errors[0],
  };

  return NextResponse.json(response, { status: result.success ? 200 : 422 });
}
