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

/** Phase 6 x402 micro-services — agents find → pay → move on Arc. */
const X402_MICRO_CATALOG: AgentSignalService[] = [
  {
    id: "sentiment-per-request",
    name: "Sentiment",
    tagline: "Classify feedback per request",
    description:
      "Classify customer or community feedback. Agent pays $0.001 USDC per request via x402.",
    priceUsd: 0.001,
    urlPath: "/api/x402/micro/sentiment",
    billingUnit: "request",
    eventType: "mcp.invocation",
    connectorId: "agent_x402",
    domain: "sentiment",
    method: "GET",
    discoverable: true,
    examplePrompt:
      "Classify sentiment for maintainer feedback: love the DX but docs lag behind releases.",
  },
  {
    id: "citation-verify",
    name: "Citation verify",
    tagline: "Verify DOI / arXiv in citation text",
    description:
      "Parse and verify citation identifiers in research snippets — $0.003 per signal.",
    priceUsd: 0.003,
    urlPath: "/api/x402/micro/citation-verify",
    billingUnit: "signal",
    eventType: "mcp.invocation",
    connectorId: "agent_x402",
    rfbProgram: "RFB #2",
    domain: "research",
    method: "GET",
    discoverable: true,
    examplePrompt:
      "Verify citation 10.1038/nature12373 in this open-science reuse summary.",
  },
  {
    id: "docs-review",
    name: "Docs review",
    tagline: "Heuristic docs quality score",
    description:
      "Score documentation PR snippets for structure and depth — $0.02 per review signal.",
    priceUsd: 0.02,
    urlPath: "/api/x402/micro/docs-review",
    billingUnit: "signal",
    eventType: "mcp.invocation",
    connectorId: "agent_x402",
    rfbProgram: "RFB #3",
    domain: "oss",
    method: "GET",
    discoverable: true,
    examplePrompt:
      "Review this React maintainer docs PR: add migration guide for concurrent features.",
  },
  {
    id: "attribution-signal",
    name: "Attribution",
    tagline: "Parse artist/track attribution",
    description:
      "Extract MusicBrainz-style attribution from play activity text — $0.002 per signal.",
    priceUsd: 0.002,
    urlPath: "/api/x402/micro/attribution",
    billingUnit: "signal",
    eventType: "mcp.invocation",
    connectorId: "agent_x402",
    rfbProgram: "RFB #7",
    domain: "music",
    method: "GET",
    discoverable: true,
    examplePrompt:
      "Attribute play — artist: Radiohead, track: Everything In Its Right Place",
  },
  {
    id: "security-signal",
    name: "Security signal",
    tagline: "CVE extraction from advisory text",
    description:
      "Extract CVE references and severity hints from security advisories — $0.10 per signal.",
    priceUsd: 0.1,
    urlPath: "/api/x402/micro/security-signal",
    billingUnit: "signal",
    eventType: "mcp.invocation",
    connectorId: "agent_x402",
    rfbProgram: "RFB #3",
    domain: "oss",
    method: "GET",
    discoverable: true,
    examplePrompt:
      "Scan advisory: CVE-2024-1234 critical RCE in react-server-dom-webpack — patch review needed.",
  },
  {
    id: "premium-research",
    name: "Premium research unlock",
    tagline: "Paid evidence for mission reasoning",
    description:
      "x402-gated research snippet — agents pay ~$0.007 USDC for policy-grade insight during missions.",
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
];

/** Community sensor paths — authorize via programs, not x402 invoke. */
const SENSOR_INGEST_SERVICES: AgentSignalService[] = [
  {
    id: "play-attribution",
    name: "Play attribution (sensor)",
    tagline: "Pay per verified listen — ListenBrainz",
    description: "Sensor ingest path for user-centric royalties programs.",
    priceUsd: 0.0004,
    urlPath: "/api/authorization/ingest",
    billingUnit: "play",
    eventType: "scrobble.play",
    connectorId: "listenbrainz",
    rfbProgram: "RFB #7",
    domain: "music",
    method: "POST",
    discoverable: false,
    examplePrompt: "Route $0.0004 per verified play to attributed artists on Navidrome.",
  },
  {
    id: "citation-toll",
    name: "Citation toll (sensor)",
    tagline: "OpenAlex citation ingest",
    description: "Micropayment per verified citation via OpenAlex sensor.",
    priceUsd: 0.05,
    urlPath: "/api/authorization/ingest",
    billingUnit: "citation",
    eventType: "feed.cite",
    connectorId: "openalex",
    rfbProgram: "RFB #2",
    domain: "research",
    method: "POST",
    discoverable: false,
    examplePrompt: "Authorize $0.05 when a paper cites an attributed work.",
  },
  {
    id: "docs-merge",
    name: "Docs merge bounty (sensor)",
    tagline: "GitHub merge ingest",
    description: "GitHub sensor authorizes maintainer value when documentation PRs merge.",
    priceUsd: 25,
    urlPath: "/api/authorization/ingest",
    billingUnit: "merge",
    eventType: "contribution.merge",
    connectorId: "github",
    rfbProgram: "RFB #3",
    domain: "oss",
    method: "POST",
    discoverable: false,
    examplePrompt: "Fund the next docs merge at $25 when GitHub sensor confirms merge.",
  },
  {
    id: "video-watch",
    name: "Video watch royalty (sensor)",
    tagline: "Jellyfin watch ingest",
    description: "Self-hosted video watches become creator authorizations.",
    priceUsd: 0.002,
    urlPath: "/api/authorization/ingest",
    billingUnit: "view",
    eventType: "video.watch",
    connectorId: "jellyfin",
    rfbProgram: "RFB #7",
    domain: "video",
    method: "POST",
    discoverable: false,
    examplePrompt: "Authorize creator value when a verified Jellyfin watch completes.",
  },
];

export const AGENT_SIGNAL_SERVICES: AgentSignalService[] = [
  ...X402_MICRO_CATALOG,
  ...SENSOR_INGEST_SERVICES,
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
