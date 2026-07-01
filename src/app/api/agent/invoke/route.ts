import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireReadyUser } from "@/lib/auth/session";
import {
  invokeAgentService,
  matchServiceForPrompt,
} from "@/lib/agent/commerce";
import { describeAgentCommerceFeePath } from "@/lib/agent/fee-path";
import { getAgentSignalService } from "@/lib/agent/service-registry";
import {
  assertAgentWalletBalance,
  chargeUserForAgentSignal,
} from "@/lib/agent/user-wallet-charge";
import type { X402MicroResult } from "@/lib/agent/x402-micro";

type InvokeBody = {
  serviceId?: string;
  taskId?: string;
  prompt?: string;
  text?: string;
  missionId?: string;
  maxSpendUsd?: number;
};

function asMicroResult(data: unknown): X402MicroResult | null {
  if (!data || typeof data !== "object") return null;
  const d = data as X402MicroResult;
  if (typeof d.summary !== "string") return null;
  return d;
}

function buildSummary(
  serviceId: string,
  data: unknown,
): { headline: string; detail: string } {
  const micro = asMicroResult(data);
  if (micro) {
    const headline =
      micro.findings?.[0] ?? micro.summary;
    const detail =
      micro.recommendations?.[0] ??
      `Service ${micro.service} · ${micro.billingUnit}`;
    return { headline, detail };
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
    detail: "Structured signal returned — see execution report",
  };
}

function buildExecutionReport(data: unknown) {
  const micro = asMicroResult(data);
  if (!micro) return null;
  return {
    steps: micro.steps ?? [],
    findings: micro.findings ?? [],
    recommendations: micro.recommendations ?? [],
    deliverables: micro.deliverables ?? [],
    inputPreview: micro.input,
    payload: micro.payload,
    generatedAt: micro.generatedAt,
  };
}

/** Invoke a pay-per-signal service — wallet debit + ledger authorization + execution report. */
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
  if (!service) {
    return NextResponse.json({ error: "Unknown service" }, { status: 400 });
  }

  const budgetUsd = Math.max(body.maxSpendUsd ?? service.priceUsd ?? 0.05, 0.05);
  const priceUsd = service.priceUsd;

  const balanceCheck = await assertAgentWalletBalance(ready.user.id, priceUsd);
  if (!balanceCheck.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: balanceCheck.error,
        wallet: { balanceUsd: balanceCheck.balanceUsd },
      },
      { status: 402 },
    );
  }

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
        isDemo: false,
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

  const succeeded = result.ok || Boolean(result.authorizationId);
  let wallet:
    | {
        chargedUsd: number;
        balanceUsd: number;
        previousBalanceUsd: number;
      }
    | undefined;
  let walletError: string | undefined;

  if (succeeded && result.amountUsd > 0) {
    const charge = await chargeUserForAgentSignal({
      userId: ready.user.id,
      amountUsd: result.amountUsd,
      serviceId,
      serviceName: result.serviceName,
      taskId,
      authorizationId: result.authorizationId,
    });
    if (charge.ok) {
      wallet = {
        chargedUsd: charge.chargedUsd,
        balanceUsd: charge.balanceUsd,
        previousBalanceUsd: charge.previousBalanceUsd,
      };
    } else {
      walletError = charge.error;
    }
  }

  const summary = buildSummary(serviceId, result.data);
  const feePath = describeAgentCommerceFeePath(result.amountUsd);
  const execution = buildExecutionReport(result.data);

  return NextResponse.json({
    ok: succeeded && !walletError,
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
    execution,
    feePath,
    wallet,
    walletError,
    taskId,
    error: walletError ?? result.error,
  });
}
