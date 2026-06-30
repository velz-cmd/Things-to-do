import type { ToolResult } from "./index";
import {
  accessPremiumResearchSource,
  fetchWithAgentPay,
  type AgentPayResult,
} from "@/lib/agent/agent-pay";

export type PaidResourceData = {
  content?: unknown;
  amountUsd: number;
  txRef: string | null;
  meteringMode: string;
  url: string;
};

function toToolResult(
  result: AgentPayResult,
  tool: string
): ToolResult<PaidResourceData> {
  return {
    ok: result.ok,
    tool,
    costUsd: result.amountUsd,
    data: {
      content: result.data,
      amountUsd: result.amountUsd,
      txRef: result.txRef,
      meteringMode: result.meteringMode,
      url: result.url,
    },
    error: result.error,
  };
}

/** Pay for x402 sentiment classify (~$0.001 USDC). */
export async function paidSentimentClassify(input: {
  taskId: string;
  text: string;
}): Promise<ToolResult<PaidResourceData>> {
  const { invokeAgentService } = await import("@/lib/agent/commerce");
  const result = await invokeAgentService({
    serviceId: "sentiment-per-request",
    taskId: input.taskId,
    query: { text: input.text },
  });
  return toToolResult(result, "agent.paySentiment");
}

/** Pay for x402 premium research (Circle Agent Stack demo endpoint). */
export async function paidPremiumResearch(
  taskId: string
): Promise<ToolResult<PaidResourceData>> {
  const result = await accessPremiumResearchSource(taskId);
  return toToolResult(result, "agent.payPremiumResearch");
}

/** Generic paid fetch — handles 402 via Circle Gateway within task budget. */
export async function paidFetchResource(input: {
  taskId: string;
  url: string;
  maxSpendUsd?: number;
}): Promise<ToolResult<PaidResourceData>> {
  const result = await fetchWithAgentPay({
    taskId: input.taskId,
    url: input.url,
    maxSpendUsd: input.maxSpendUsd,
    purpose: "x402:fetch",
  });
  return toToolResult(result, "agent.paidFetch");
}
