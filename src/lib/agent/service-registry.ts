/**
 * Agent Signal Commerce — discoverable pay-per-request services.
 * Maps Circle Agent Stack x402 flows to RESOLVE RFB pay-per-signal doctrine.
 */

export type AgentBillingUnit =
  | "request"
  | "signal"
  | "play"
  | "citation"
  | "merge"
  | "view";

export type AgentSignalService = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  /** Per-unit price in USDC */
  priceUsd: number;
  /** App-relative path — resolved to full URL at runtime */
  urlPath: string;
  billingUnit: AgentBillingUnit;
  /** Ledger event type after successful pay */
  eventType: string;
  connectorId: string;
  /** RFB alignment when applicable */
  rfbProgram?: string;
  domain: "sentiment" | "research" | "music" | "oss" | "video" | "agent";
  method: "GET" | "POST";
  /** Shown in Discover agent market */
  discoverable: boolean;
  /** Example agent prompt (Circle-style) */
  examplePrompt: string;
};

export const AGENT_SIGNAL_SERVICES: AgentSignalService[] = [
  {
    id: "sentiment-per-request",
    name: "Sentiment classify",
    tagline: "Pay per feedback line — pipeline keeps moving",
    description:
      "Classify customer feedback sentiment. Agent finds the API, pays ~$0.001 USDC per request, returns label + score.",
    priceUsd: 0.001,
    urlPath: "/api/x402/sentiment",
    billingUnit: "request",
    eventType: "mcp.invocation",
    connectorId: "agent_x402",
    domain: "sentiment",
    method: "GET",
    discoverable: true,
    examplePrompt:
      "My data pipeline needs sentiment analysis. Classify this customer feedback and keep moving.",
  },
  {
    id: "premium-research",
    name: "Premium research unlock",
    tagline: "Paid evidence for mission reasoning",
    description:
      "x402-gated research snippet — agents pay ~$0.007 USDC for policy-grade insight during Deputy missions.",
    priceUsd: 0.007,
    urlPath: "/api/x402/premium-research",
    billingUnit: "signal",
    eventType: "mcp.invocation",
    connectorId: "agent_x402",
    rfbProgram: "RFB #2",
    domain: "research",
    method: "GET",
    discoverable: true,
    examplePrompt: "Unlock paid research before allocating capital to this maintainer gap.",
  },
  {
    id: "play-attribution",
    name: "Play attribution signal",
    tagline: "Pay per verified listen — RFB #7",
    description:
      "Maps to user-centric royalties: each verified play authorizes artist value at event time (sensor path).",
    priceUsd: 0.0004,
    urlPath: "/api/authorization/ingest",
    billingUnit: "play",
    eventType: "scrobble.play",
    connectorId: "listenbrainz",
    rfbProgram: "RFB #7",
    domain: "music",
    method: "POST",
    discoverable: true,
    examplePrompt: "Route $0.0004 per verified play to attributed artists on Navidrome.",
  },
  {
    id: "citation-toll",
    name: "Citation toll",
    tagline: "Pay per article signal — RFB #2",
    description:
      "Micropayment per verified citation — OpenAlex sensor authorizes researcher value.",
    priceUsd: 0.05,
    urlPath: "/api/authorization/ingest",
    billingUnit: "citation",
    eventType: "feed.cite",
    connectorId: "openalex",
    rfbProgram: "RFB #2",
    domain: "research",
    method: "POST",
    discoverable: true,
    examplePrompt: "Authorize $0.05 when a paper cites an attributed work.",
  },
  {
    id: "docs-merge",
    name: "Docs merge bounty",
    tagline: "Pay per merged PR — RFB #3",
    description:
      "GitHub sensor authorizes maintainer value when documentation PRs merge.",
    priceUsd: 25,
    urlPath: "/api/authorization/ingest",
    billingUnit: "merge",
    eventType: "contribution.merge",
    connectorId: "github",
    rfbProgram: "RFB #3",
    domain: "oss",
    method: "POST",
    discoverable: true,
    examplePrompt: "Fund the next docs merge at $25 when GitHub sensor confirms merge.",
  },
  {
    id: "video-watch",
    name: "Video watch royalty",
    tagline: "Pay per verified view — Jellyfin",
    description:
      "Self-hosted video watches become creator authorizations — RFB #7 video variant.",
    priceUsd: 0.002,
    urlPath: "/api/authorization/ingest",
    billingUnit: "view",
    eventType: "video.watch",
    connectorId: "jellyfin",
    rfbProgram: "RFB #7",
    domain: "video",
    method: "POST",
    discoverable: true,
    examplePrompt: "Authorize creator value when a verified Jellyfin watch completes.",
  },
];

export function getAgentSignalService(id: string): AgentSignalService | undefined {
  return AGENT_SIGNAL_SERVICES.find((s) => s.id === id);
}

export function listDiscoverableAgentServices(): AgentSignalService[] {
  return AGENT_SIGNAL_SERVICES.filter((s) => s.discoverable);
}

export function resolveServiceUrl(
  service: AgentSignalService,
  baseUrl: string,
  query?: Record<string, string>,
): string {
  const base = baseUrl.replace(/\/$/, "");
  const url = new URL(`${base}${service.urlPath}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, v);
    }
  }
  return url.toString();
}
