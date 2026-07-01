import {
  getAgentSignalService,
  listDiscoverableAgentServices,
  resolveServiceUrl,
  type AgentSignalService,
} from "@/lib/agent/service-registry";
import { payForResource, recordAgentSpend, type AgentPayResult } from "@/lib/agent/agent-pay";
import { recordAgentInvocation } from "@/lib/agent/invocation-ledger";
import { getAppBaseUrl, isAgentGatewayEnabled } from "@/lib/agent/gateway-config";
import { isProductionDeploy } from "@/lib/config/demo-mode";
import {
  runX402MicroService,
  x402MicroSlugFromServiceId,
  type X402MicroResult,
} from "@/lib/agent/x402-micro";
import { matchServiceForPrompt } from "@/lib/agent/commerce-match";

export { matchServiceForPrompt } from "@/lib/agent/commerce-match";

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
  const microSlug = x402MicroSlugFromServiceId(service.id);
  let pay: AgentPayResult<X402MicroResult | { sentiment?: string; score?: number }>;

  if (!isAgentGatewayEnabled() && isProductionDeploy()) {
    return {
      ok: false,
      serviceId: service.id,
      serviceName: service.name,
      amountUsd: 0,
      txRef: null,
      meteringMode: "skipped",
      error:
        "Live agent payments require x402 gateway (ARC_AGENT_GATEWAY_PRIVATE_KEY) and a funded Arc wallet. Configure gateway env vars or use dev preview for metered invoke.",
      url,
      continue: false,
      rfbProgram: service.rfbProgram,
    };
  }

  if (!isAgentGatewayEnabled() && microSlug) {
    const text = input.query?.text ?? "";
    const direct = runX402MicroService(microSlug, text);
    if (direct) {
      await recordAgentSpend({
        taskId: input.taskId,
        purpose: `x402:${service.id} (metered)`,
        amountUsd: service.priceUsd,
        meteringMode: "offchain_metered",
      });
    }
    pay = {
      ok: Boolean(direct),
      data: direct ?? undefined,
      amountUsd: service.priceUsd,
      txRef: null,
      meteringMode: "offchain_metered",
      error: direct ? undefined : "Micro-service unavailable",
      url,
    };
  } else {
    pay = await payForResource({
      taskId: input.taskId,
      url,
      maxSpendUsd: input.maxSpendUsd ?? service.priceUsd * 2,
      purpose: `x402:${service.id}`,
    });
  }

  let authorizationId: string | undefined;
  const ledgerEligible =
    pay.amountUsd > 0 &&
    (pay.meteringMode === "gateway_live" ||
      (pay.ok && Boolean(pay.txRef)) ||
      (!isProductionDeploy() && pay.meteringMode === "offchain_metered" && pay.ok));
  if (ledgerEligible) {
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
    ...(pay as AgentPayResult<T>),
    serviceId: service.id,
    serviceName: service.name,
    authorizationId,
    continue: pay.ok || Boolean(authorizationId),
    rfbProgram: service.rfbProgram,
  };
}
