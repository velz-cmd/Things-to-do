import { prisma } from "@/lib/db";
import { recordExecutionCost } from "@/lib/settlement/settlement-db";
import {
  ensureGatewayDeposit,
  getAgentGatewayClient,
} from "@/lib/agent/gateway-client";
import {
  getAgentX402PremiumUrl,
  getDefaultPaidSourcePriceUsd,
  isAgentGatewayEnabled,
} from "@/lib/agent/gateway-config";

export type AgentPayResult<T = unknown> = {
  ok: boolean;
  data?: T;
  amountUsd: number;
  txRef: string | null;
  meteringMode: "gateway_live" | "offchain_metered" | "skipped";
  error?: string;
  url: string;
};

function parsePaidAmount(formattedAmount: string): number {
  const n = Number(formattedAmount);
  return Number.isFinite(n) ? n : 0;
}

export async function getRemainingTaskBudget(taskId: string): Promise<number> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { budgetUsd: true, executionCostUsd: true },
  });
  if (!task) return 0;
  return Math.max(0, task.budgetUsd - task.executionCostUsd);
}

export async function recordAgentSpend(input: {
  taskId: string;
  purpose: string;
  amountUsd: number;
  meteringMode: string;
  txHash?: string | null;
  agent?: string;
}) {
  // Sequential writes — interactive $transaction blocks on PgBouncer + connection_limit=1.
  await prisma.microPayment.create({
    data: {
      taskId: input.taskId,
      purpose: input.purpose,
      amountUsd: input.amountUsd,
      txHash: input.txHash ?? null,
    },
  });

  await prisma.executionCostEvent.create({
    data: {
      taskId: input.taskId,
      agent: input.agent ?? "AgentPay",
      action: input.purpose,
      amountUsdc: input.amountUsd,
      meteringMode: input.meteringMode,
      txHash: input.txHash ?? null,
    },
  });

  await prisma.task.update({
    where: { id: input.taskId },
    data: { executionCostUsd: { increment: input.amountUsd } },
  });
}

/** Pay for an x402 resource within the task USDC budget (Circle Gateway on Arc testnet). */
export async function payForResource<T = unknown>(input: {
  taskId: string;
  url: string;
  maxSpendUsd?: number;
  purpose?: string;
}): Promise<AgentPayResult<T>> {
  const purpose = input.purpose ?? "x402:paid_source";
  const remaining = await getRemainingTaskBudget(input.taskId);
  const cap = input.maxSpendUsd ?? remaining;
  const maxSpend = Math.min(remaining, cap);

  if (maxSpend <= 0) {
    return {
      ok: false,
      amountUsd: 0,
      txRef: null,
      meteringMode: "skipped",
      error: "Task budget exhausted",
      url: input.url,
    };
  }

  if (!isAgentGatewayEnabled()) {
    const demoAmount = Math.min(maxSpend, getDefaultPaidSourcePriceUsd());
    await recordAgentSpend({
      taskId: input.taskId,
      purpose: `${purpose} (demo)`,
      amountUsd: demoAmount,
      meteringMode: "offchain_metered",
    });
    return {
      ok: false,
      amountUsd: demoAmount,
      txRef: null,
      meteringMode: "offchain_metered",
      error: "ARC_AGENT_GATEWAY_PRIVATE_KEY not configured — recorded demo spend",
      url: input.url,
    };
  }

  const gateway = getAgentGatewayClient();
  if (!gateway) {
    return {
      ok: false,
      amountUsd: 0,
      txRef: null,
      meteringMode: "skipped",
      error: "Gateway client unavailable",
      url: input.url,
    };
  }

  try {
    await ensureGatewayDeposit("0.05");

    const support = await gateway.supports(input.url);
    if (!support.supported) {
      return {
        ok: false,
        amountUsd: 0,
        txRef: null,
        meteringMode: "skipped",
        error: support.error ?? "URL does not support Circle Gateway x402",
        url: input.url,
      };
    }

    const paid = await gateway.pay<T>(input.url);
    const amountUsd = parsePaidAmount(paid.formattedAmount);

    if (amountUsd > maxSpend) {
      return {
        ok: false,
        amountUsd,
        txRef: paid.transaction,
        meteringMode: "gateway_live",
        error: `Payment $${amountUsd} exceeds task cap $${maxSpend.toFixed(3)}`,
        url: input.url,
      };
    }

    await recordAgentSpend({
      taskId: input.taskId,
      purpose,
      amountUsd,
      meteringMode: "gateway_live",
      txHash: paid.transaction,
    });

    return {
      ok: true,
      data: paid.data,
      amountUsd,
      txRef: paid.transaction,
      meteringMode: "gateway_live",
      url: input.url,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gateway pay failed";
    console.error("[agent-pay]", message);
    return {
      ok: false,
      amountUsd: 0,
      txRef: null,
      meteringMode: "skipped",
      error: message,
      url: input.url,
    };
  }
}

/** Fetch with automatic x402 pay when response is 402 Payment Required. */
export async function fetchWithAgentPay(input: {
  taskId: string;
  url: string;
  maxSpendUsd?: number;
  purpose?: string;
}): Promise<AgentPayResult<string>> {
  const initial = await fetch(input.url, { method: "GET" });
  if (initial.status !== 402) {
    const text = await initial.text();
    if (!initial.ok) {
      return {
        ok: false,
        amountUsd: 0,
        txRef: null,
        meteringMode: "skipped",
        error: `HTTP ${initial.status}`,
        url: input.url,
      };
    }
    return {
      ok: true,
      data: text,
      amountUsd: 0,
      txRef: null,
      meteringMode: "skipped",
      url: input.url,
    };
  }

  return payForResource<string>(input);
}

export async function accessPremiumResearchSource(taskId: string): Promise<AgentPayResult> {
  const url = getAgentX402PremiumUrl();
  if (!url) {
    return {
      ok: false,
      amountUsd: 0,
      txRef: null,
      meteringMode: "skipped",
      error: "No x402 premium URL configured",
      url: "",
    };
  }

  const maxSpend = Math.min(
    await getRemainingTaskBudget(taskId),
    getDefaultPaidSourcePriceUsd()
  );

  return payForResource({
    taskId,
    url,
    maxSpendUsd: maxSpend,
    purpose: "x402:premium_research",
  });
}
