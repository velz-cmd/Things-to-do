import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { dbPoolErrorMessage, isDbPoolExhaustedError } from "@/lib/db/connection";
import { requireReadyUser } from "@/lib/auth/session";
import {
  invokeAgentService,
  matchServiceForPrompt,
} from "@/lib/agent/commerce";
import { chargeAgentSignalOnArc } from "@/lib/agent/agent-signal-arc-payment";
import { chargeAgentSignalWithExternalTx } from "@/lib/agent/agent-signal-with-tx";
import { describeAgentCommerceFeePath } from "@/lib/agent/fee-path";
import { getAgentSignalService } from "@/lib/agent/service-registry";
import { isProductionDeploy } from "@/lib/config/demo-mode";
import { circleUserMessage } from "@/lib/wallet/circle-errors";
import type { X402MicroResult } from "@/lib/agent/x402-micro";

export const maxDuration = 120;

type InvokeBody = {
  serviceId?: string;
  taskId?: string;
  prompt?: string;
  text?: string;
  missionId?: string;
  maxSpendUsd?: number;
  /** Verified when user paid with a connected wallet on Arc */
  paymentTxHash?: string;
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
    const headline = micro.findings?.[0] ?? micro.summary;
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

function isAgentSignalSuccessful(serviceId: string, data: unknown): boolean {
  const micro = asMicroResult(data);
  if (!micro) return true;
  if (serviceId === "attribution-signal" && micro.payload && typeof micro.payload === "object") {
    const payload = micro.payload as { parseable?: boolean };
    if (payload.parseable === false) return false;
  }
  if (micro.findings?.some((f) => /could not extract|no labeled fields found/i.test(f))) {
    return false;
  }
  return true;
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

/** Invoke a pay-per-signal service — Arc USDC charge first, then intel. No off-chain-only charges in production. */
export async function POST(req: Request) {
  try {
    return await handleAgentInvoke(req);
  } catch (e) {
    if (isDbPoolExhaustedError(e)) {
      return NextResponse.json(
        { ok: false, error: dbPoolErrorMessage() },
        { status: 503 },
      );
    }
    throw e;
  }
}

async function handleAgentInvoke(req: Request) {
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

  let payment:
    | {
        txHash: string;
        explorerUrl: string;
        chargedUsd: number;
        balanceUsd: number;
        previousBalanceUsd: number;
        onChainUsd: number | null;
      }
    | undefined;

  if (isProductionDeploy()) {
    const arcCharge = body.paymentTxHash
      ? await chargeAgentSignalWithExternalTx({
          userId: ready.user.id,
          amountUsd: priceUsd,
          serviceId,
          taskId,
          txHash: body.paymentTxHash,
          identityWalletAddress: ready.profile.walletAddress,
        })
      : await chargeAgentSignalOnArc({
          user: ready.profile,
          amountUsd: priceUsd,
          serviceId,
          taskId,
        });

    if (!arcCharge.ok) {
      const userError = circleUserMessage(arcCharge.error);
      return NextResponse.json(
        {
          ok: false,
          error: userError,
          wallet: {
            balanceUsd: arcCharge.balanceUsd,
            onChainUsd: arcCharge.onChainUsd,
          },
        },
        { status: arcCharge.error.includes("Insufficient") ? 402 : 503 },
      );
    }

    payment = {
      txHash: arcCharge.txHash,
      explorerUrl: arcCharge.explorerUrl,
      chargedUsd: arcCharge.chargedUsd,
      balanceUsd: arcCharge.balanceUsd,
      previousBalanceUsd: arcCharge.previousBalanceUsd,
      onChainUsd: arcCharge.onChainUsd,
    };
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
    prepaidArcTxHash: payment?.txHash,
  });

  const succeeded = result.ok && Boolean(result.data) && isAgentSignalSuccessful(serviceId, result.data);

  if (!succeeded) {
    const execution = buildExecutionReport(result.data);
    const summary = buildSummary(serviceId, result.data);
    return NextResponse.json(
      {
        ok: false,
        error:
          execution?.findings?.[0] ??
          result.error ??
          "Agent signal could not produce usable output",
        summary,
        execution,
        payment,
        taskId,
        meteringMode: result.meteringMode,
      },
      { status: 502 },
    );
  }

  const summary = buildSummary(serviceId, result.data);
  const feePath = describeAgentCommerceFeePath(result.amountUsd);
  const execution = buildExecutionReport(result.data);

  return NextResponse.json({
    ok: true,
    continue: result.continue,
    serviceId: result.serviceId,
    serviceName: result.serviceName,
    amountUsd: result.amountUsd,
    txRef: payment?.txHash ?? result.txRef,
    meteringMode: result.meteringMode,
    authorizationId: result.authorizationId,
    receiptHref: result.authorizationId ? `/receipt/${result.authorizationId}` : null,
    rfbProgram: result.rfbProgram,
    data: result.data,
    summary,
    execution,
    feePath,
    payment,
    wallet: payment
      ? {
          chargedUsd: payment.chargedUsd,
          balanceUsd: payment.balanceUsd,
          previousBalanceUsd: payment.previousBalanceUsd,
        }
      : undefined,
    taskId,
  });
}
