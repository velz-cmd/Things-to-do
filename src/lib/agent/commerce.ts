import {
  getAgentSignalService,
  listDiscoverableAgentServices,
  resolveServiceUrl,
  type AgentSignalService,
} from "@/lib/agent/service-registry";
import { payForResource, type AgentPayResult } from "@/lib/agent/agent-pay";
import { recordAgentInvocation } from "@/lib/agent/invocation-ledger";
import { getAppBaseUrl } from "@/lib/agent/gateway-config";

export type AgentCommerceInvokeResult<T = unknown> = AgentPayResult<T> & {
  serviceId: string;
  serviceName: string;
  authorizationId?: string;
  continue: boolean;
  rfbProgram?: string;
};

/** Discover — list pay-per-signal services agents can invoke. */
export function discoverAgentServices() {
  return listDiscoverableAgentServices().map((s) => ({
    id: s.id,
    name: s.name,
    tagline: s.tagline,
    description: s.description,
    priceUsd: s.priceUsd,
    billingUnit: s.billingUnit,
    domain: s.domain,
    eventType: s.eventType,
    connectorId: s.connectorId,
    rfbProgram: s.rfbProgram,
    examplePrompt: s.examplePrompt,
    x402: s.urlPath.startsWith("/api/x402/"),
    ingest: !s.urlPath.startsWith("/api/x402/"),
    url: resolveServiceUrl(s, getAppBaseUrl()),
  }));
}

/**
 * Find → pay (x402) → authorize → return data — agent keeps moving.
 * Circle Agent Stack pattern unified with RESOLVE ledger.
 */
export async function invokeAgentService<T = unknown>(input: {
  serviceId: string;
  taskId: string;
  missionId?: string | null;
  query?: Record<string, string>;
  maxSpendUsd?: number;
}): Promise<AgentCommerceInvokeResult<T>> {
  const service = getAgentSignalService(input.serviceId);
  if (!service) {
    return {
      ok: false,
      serviceId: input.serviceId,
      serviceName: "unknown",
      amountUsd: 0,
      txRef: null,
      meteringMode: "skipped",
      error: "Unknown service",
      url: "",
      continue: false,
    };
  }

  if (!service.urlPath.startsWith("/api/x402/")) {
    return {
      ok: false,
      serviceId: service.id,
      serviceName: service.name,
      amountUsd: 0,
      txRef: null,
      meteringMode: "skipped",
      error: "Service uses sensor ingest — connect via community program, not x402 invoke",
      url: service.urlPath,
      continue: false,
      rfbProgram: service.rfbProgram,
    };
  }

  const url = resolveServiceUrl(service, getAppBaseUrl(), input.query);
  const pay = await payForResource<T>({
    taskId: input.taskId,
    url,
    maxSpendUsd: input.maxSpendUsd ?? service.priceUsd * 2,
    purpose: `x402:${service.id}`,
  });

  let authorizationId: string | undefined;
  if (pay.ok && pay.amountUsd > 0) {
    const recorded = await recordAgentInvocation({
      service,
      taskId: input.taskId,
      missionId: input.missionId,
      amountUsd: pay.amountUsd,
      txRef: pay.txRef,
      contextLabel: `${service.name} · ${service.billingUnit}`,
      rawMetadata: { url: pay.url },
    });
    if (!recorded.skipped && recorded.authorization) {
      authorizationId = recorded.authorization.id;
    }
  }

  return {
    ...pay,
    serviceId: service.id,
    serviceName: service.name,
    authorizationId,
    continue: pay.ok,
    rfbProgram: service.rfbProgram,
  };
}

export function matchServiceForPrompt(prompt: string): AgentSignalService | null {
  const lower = prompt.toLowerCase();
  if (lower.includes("sentiment") || lower.includes("feedback") || lower.includes("classify")) {
    return getAgentSignalService("sentiment-per-request") ?? null;
  }
  if (lower.includes("research") || lower.includes("premium") || lower.includes("policy")) {
    return getAgentSignalService("premium-research") ?? null;
  }
  if (lower.includes("play") || lower.includes("listen") || lower.includes("artist")) {
    return getAgentSignalService("play-attribution") ?? null;
  }
  if (lower.includes("citation") || lower.includes("article") || lower.includes("paper")) {
    return getAgentSignalService("citation-toll") ?? null;
  }
  return null;
}
