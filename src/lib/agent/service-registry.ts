/**
 * Agent Signal Commerce, discoverable pay-per-request services.
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
  /** App-relative path, resolved to full URL at runtime */
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
  /**
   * Why a person would buy this, in decision terms.
   *
   * Deliberately does NOT claim which RESOLVE object will consume the result.
   * Purchased output is not yet attachable as canonical evidence, and naming
   * a workflow it cannot actually feed would be a promise the product does
   * not keep. These fields describe only what the service itself does.
   */
  decisionContext?: {
    /** The uncertainty this resolves. */
    useWhen: string;
    /** What comes back. */
    produces: string;
    /** What it cannot establish. Always stated - these are heuristics. */
    limitations: string;
  };
};

/** Phase 6 x402 micro-services, agents find, pay, and move on Arc. */
const X402_MICRO_CATALOG: AgentSignalService[] = [
  {
    id: "sentiment-per-request",
    decisionContext: {
      useWhen:
        "You have free-text feedback and need it classified before judging whether a complaint represents a real problem.",
      produces:
        "A sentiment classification for the supplied text.",
      limitations:
        "Classifies wording only. It does not establish how many people share the view, or that the issue is real.",
    },
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
    decisionContext: {
      useWhen:
        "You need to know whether a citation identifier actually resolves, before treating the citation as reuse evidence.",
      produces:
        "DOI/arXiv identifiers found in the text, and whether each resolves.",
      limitations:
        "Confirms the identifier resolves. It does not establish that the citing work is legitimate or that the reuse was meaningful.",
    },
    name: "Citation verify",
    tagline: "Verify DOI / arXiv in citation text",
    description:
      "Parse and verify citation identifiers in research snippets, $0.003 per signal.",
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
    decisionContext: {
      useWhen:
        "You need a read on documentation quality before weighing a documentation-related outcome.",
      produces:
        "A heuristic documentation quality assessment.",
      limitations:
        "Heuristic only. It is not a measurement of whether anyone read or benefited from the documentation.",
    },
    name: "Docs review",
    tagline: "Heuristic docs quality score",
    description:
      "Score documentation PR snippets for structure and depth, $0.02 per review signal.",
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
    decisionContext: {
      useWhen:
        "You have a track or release reference and need artist/track attribution parsed before crediting a creator.",
      produces:
        "Parsed artist and track attribution for the supplied reference.",
      limitations:
        "Parses the reference given. It does not verify that the named artist is the rights holder.",
    },
    name: "Attribution",
    tagline: "Parse artist/track attribution",
    description:
      "Extract MusicBrainz-style attribution from play activity text, $0.002 per signal.",
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
      "Attribute play, artist: Radiohead, track: Everything In Its Right Place",
  },
  {
    id: "security-signal",
    decisionContext: {
      useWhen:
        "You are weighing a security-related outcome and need advisory text turned into concrete identifiers first.",
      produces:
        "CVE identifiers, severity hints and affected package references found in the advisory.",
      limitations:
        "Extracts what the advisory states. It does not confirm exploitability, or that a given fix resolved it.",
    },
    name: "Security signal",
    tagline: "CVE extraction from advisory text",
    description:
      "Extract CVE references and severity hints from security advisories, $0.10 per signal.",
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
      "Scan advisory: CVE-2024-1234 critical RCE in react-server-dom-webpack, patch review needed.",
  },
  {
    id: "premium-research",
    decisionContext: {
      useWhen:
        "You need the extended research signal behind a citation before treating it as adoption evidence.",
      produces:
        "The extended research record for the supplied reference.",
      limitations:
        "Returns what the upstream source holds. Absence is not evidence that reuse did not occur.",
    },
    name: "Premium research unlock",
    tagline: "Paid evidence for mission reasoning",
    description:
      "x402-gated research snippet, agents pay about $0.007 USDC for policy-grade insight during missions.",
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

/** Community sensor paths, authorize via programs rather than x402 invoke. */
const SENSOR_INGEST_SERVICES: AgentSignalService[] = [
  {
    id: "play-attribution",
    decisionContext: {
      useWhen:
        "You are attributing listening activity to a creator and need each play resolved to an artist.",
      produces:
        "Per-play artist attribution from the connected listening source.",
      limitations:
        "Attributes plays the connected source recorded. It is not a complete picture of listening elsewhere.",
    },
    name: "Play attribution (sensor)",
    tagline: "Pay per verified listen, ListenBrainz",
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
    decisionContext: {
      useWhen:
        "You are metering citation reuse and need each citation event priced and attributed.",
      produces:
        "A per-citation attribution record for the supplied reference.",
      limitations:
        "Covers citations the connected source observed. It does not establish the scholarly weight of the citation.",
    },
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
