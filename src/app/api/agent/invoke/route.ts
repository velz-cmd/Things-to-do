import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireReadyUser } from "@/lib/auth/session";
import {
  invokeAgentService,
  matchServiceForPrompt,
} from "@/lib/agent/commerce";
import { describeAgentCommerceFeePath } from "@/lib/agent/fee-path";
import { getAgentSignalService } from "@/lib/agent/service-registry";
import type { X402MicroResult } from "@/lib/agent/x402-micro";

type InvokeBody = {
  serviceId?: string;
  taskId?: string;
  prompt?: string;
  text?: string;
  missionId?: string;
  maxSpendUsd?: number;
};

function buildSummary(
  serviceId: string,
  data: unknown,
): { headline: string; detail: string } {
  const micro = data as X402MicroResult | undefined;
  if (micro?.summary) {
    return { headline: micro.summary, detail: `Service ${micro.service} · ${micro.billingUnit}` };
  }
  const legacy = data as { sentiment?: string; score?: number; insight?: string } | undefined;
  if (legacy?.sentiment) {
    return {
      headline: `Sentiment ${legacy.sentiment}`,
      detail: legacy.score != null ? `Score ${Math.round(legacy.score * 100)}%` : "Classified",
    };
  }
  if (legacy?.insight) {
    return { headline: legacy.insight.slice(0, 120), detail: "Premium research unlock" };
  }
  const svc = getAgentSignalService(serviceId);
  return {
    headline: svc ? `${svc.name} completed` : "Agent task completed",
    detail: "Structured signal returned — see payload",
  };
}

/** Invoke a pay-per-signal service — x402 pay + ledger authorization. */
export async function POST(req: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const body = (await req.json()) as InvokeBody;
  let serviceId = body.serviceId;
  const prompt = body.prompt ?? body.text ?? "";
  if (!serviceId && prompt) {
    serviceId = matchServiceForPrompt(prompt)?.id;
  }
  if (!serviceId) {
    return NextResponse.json({ error: "serviceId or matching prompt required" }, { status: 400 });
  }

  const service = getAgentSignalService(serviceId);
  const budgetUsd = Math.max(body.maxSpendUsd ?? service?.priceUsd ?? 0.05, 0.05);

  let taskId = body.taskId;
  if (!taskId) {
    const task = await prisma.task.create({
      data: {
        title: prompt
          ? `Agent intel · ${prompt.slice(0, 48)}`
          : `Agent signal · ${serviceId}`,
        category: "agent_commerce",
        targetValueUsd: 1,
        budgetUsd,
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
  const text = body.text ?? body.prompt;
  if (text) query.text = text;

  const result = await invokeAgentService({
    serviceId,
    taskId,
    missionId: body.missionId,
    query: Object.keys(query).length ? query : undefined,
    maxSpendUsd: budgetUsd,
  });

  const summary = buildSummary(serviceId, result.data);
  const feePath = describeAgentCommerceFeePath(result.amountUsd);

  return NextResponse.json({
    ok: result.ok || Boolean(result.authorizationId),
    continue: result.continue,
    serviceId: result.serviceId,
    serviceName: result.serviceName,
    amountUsd: result.amountUsd,
    txRef: result.txRef,
    meteringMode: result.meteringMode,
    authorizationId: result.authorizationId,
    receiptHref: result.authorizationId ? `/receipt/${result.authorizationId}` : null,
    rfbProgram: result.rfbProgram,
    data: result.data,
    summary,
    feePath,
    taskId,
    error: result.error,
  });
}
