import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireReadyUser } from "@/lib/auth/session";
import { createTaskFromTemplate } from "@/lib/deputy/orchestrator";
import { DEMO_OUTCOMES } from "@/lib/deputy/types";

export async function POST(req: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const body = await req.json();
  const templateId = body.templateId as string;

  if (templateId) {
    const template = DEMO_OUTCOMES.find((t) => t.id === templateId);
    if (!template) {
      return NextResponse.json({ error: "Unknown mission template" }, { status: 400 });
    }
    const task = await createTaskFromTemplate(template, ready.profile.walletAddress!);
    await prisma.task.update({
      where: { id: task.id },
      data: { userId: ready.user.id, userWallet: ready.profile.walletAddress },
    });
    return NextResponse.json({ task, template });
  }

  const title = String(body.title ?? "Custom payment mission");
  const category = String(body.category ?? "bounty");
  const targetValueUsd = Number(body.targetValueUsd ?? 100);
  const merchantId = String(body.merchantId ?? `mission-${Date.now()}`);

  const task = await prisma.task.create({
    data: {
      title,
      category,
      targetValueUsd,
      successFeeUsd: 0.2,
      budgetUsd: Math.max(targetValueUsd * 0.05, 1),
      merchantId,
      userId: ready.user.id,
      userWallet: ready.profile.walletAddress,
      status: "created",
      currentAgent: "Planner",
    },
  });

  return NextResponse.json({ task });
}
