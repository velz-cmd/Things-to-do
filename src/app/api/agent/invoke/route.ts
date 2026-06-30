import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireReadyUser } from "@/lib/auth/session";
import {
  invokeAgentService,
  matchServiceForPrompt,
} from "@/lib/agent/commerce";

type InvokeBody = {
  serviceId?: string;
  taskId?: string;
  prompt?: string;
  text?: string;
  missionId?: string;
  maxSpendUsd?: number;
};

/** Invoke a pay-per-signal service — x402 pay + ledger authorization. */
export async function POST(req: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const body = (await req.json()) as InvokeBody;
  let serviceId = body.serviceId;
  if (!serviceId && body.prompt) {
    serviceId = matchServiceForPrompt(body.prompt)?.id;
  }
  if (!serviceId) {
    return NextResponse.json({ error: "serviceId or matching prompt required" }, { status: 400 });
  }

  let taskId = body.taskId;
  if (!taskId) {
    const task = await prisma.task.create({
      data: {
        title: `Agent signal · ${serviceId}`,
        category: "agent_commerce",
        targetValueUsd: 1,
        budgetUsd: Math.max(body.maxSpendUsd ?? 0.05, 0.05),
        userId: ready.user.id,
        userWallet: ready.profile.walletAddress,
        status: "created",
        currentAgent: "AgentCommerce",
        isDemo: true,
      },
    });
    taskId = task.id;
  }

  const query: Record<string, string> = {};
  if (body.text) query.text = body.text;
  if (body.prompt && serviceId === "sentiment-per-request" && !body.text) {
    query.text = body.prompt;
  }

  const result = await invokeAgentService({
    serviceId,
    taskId,
    missionId: body.missionId,
    query: Object.keys(query).length ? query : undefined,
    maxSpendUsd: body.maxSpendUsd,
  });

  return NextResponse.json({
    ok: result.ok,
    continue: result.continue,
    serviceId: result.serviceId,
    serviceName: result.serviceName,
    amountUsd: result.amountUsd,
    txRef: result.txRef,
    meteringMode: result.meteringMode,
    authorizationId: result.authorizationId,
    rfbProgram: result.rfbProgram,
    data: result.data,
    taskId,
    error: result.error,
  });
}
