/**
 * RESOLVE capabilities — stable architecture surface.
 * APIs are implementations; capabilities survive API swaps.
 *
 * @see docs/ARCHITECTURE.md
 */

export type CapabilityId =
  | "code_intelligence"
  | "music_attribution"
  | "research_attribution"
  | "video_attribution"
  | "feed_attribution"
  | "community_signals"
  | "blockchain_settlement"
  | "blockchain_verification"
  | "identity_resolution"
  | "communication"
  | "ai_reasoning"
  | "payments"
  | "graph_analysis"
  | "semantic_search"
  | "treasury_management"
  | "policy_engine"
  | "allocation_simulation";

export type CapabilityStatus = "live" | "partial" | "planned";

export type Capability = {
  id: CapabilityId;
  label: string;
  description: string;
  status: CapabilityStatus;
  /** Current implementations — may change without architecture change */
  implementations: string[];
  /** Code modules that implement this capability today */
  modules: string[];
};

export const CAPABILITIES: Capability[] = [
  {
    id: "code_intelligence",
    label: "Code intelligence",
    description: "Repositories, contributions, dependencies, downstream usage",
    status: "partial",
    implementations: ["GitHub API", "Libraries.io (upstream signals)"],
    modules: ["lib/github", "lib/evidence", "lib/connectors/upstream"],
  },
  {
    id: "music_attribution",
    label: "Music attribution",
    description: "Plays, credits, artist/recording resolution",
    status: "partial",
    implementations: ["MusicBrainz", "ListenBrainz", "Navidrome"],
    modules: ["lib/attribution/musicbrainz", "lib/connectors/navidrome", "lib/connectors/music-pipeline"],
  },
  {
    id: "research_attribution",
    label: "Research attribution",
    description: "Citations, authorship, institutional links",
    status: "partial",
    implementations: ["OpenAlex", "Crossref (planned)"],
    modules: ["lib/sensors/openalex-citations", "lib/connectors/openalex"],
  },
  {
    id: "video_attribution",
    label: "Video attribution",
    description: "Views, creator splits, instance federation",
    status: "planned",
    implementations: ["PeerTube (planned)", "Owncast (planned)"],
    modules: [],
  },
  {
    id: "feed_attribution",
    label: "Feed attribution",
    description: "RSS/Atom consumption and republication",
    status: "planned",
    implementations: ["RSSHub (planned)"],
    modules: [],
  },
  {
    id: "community_signals",
    label: "Community signals",
    description: "Moderation, federation, social graph activity",
    status: "planned",
    implementations: ["Mastodon ActivityPub (planned)"],
    modules: [],
  },
  {
    id: "blockchain_settlement",
    label: "Blockchain settlement",
    description: "USDC batching, cross-border payouts on Arc",
    status: "partial",
    implementations: ["Circle Arc", "Circle Gateway"],
    modules: ["lib/arc", "lib/settlement", "lib/payment"],
  },
  {
    id: "blockchain_verification",
    label: "Blockchain verification",
    description: "On-chain receipt and transaction proof",
    status: "partial",
    implementations: ["Blockscout", "Arc explorer"],
    modules: ["lib/payment/tx-utils"],
  },
  {
    id: "identity_resolution",
    label: "Identity resolution",
    description: "Link persons across GitHub, wallets, music, research IDs",
    status: "partial",
    implementations: ["GitHub OAuth", "Reown wallets", "MusicBrainz", "ORCID (planned)", "ENS (planned)"],
    modules: ["lib/registry", "lib/identity", "prisma ContributorRegistry"],
  },
  {
    id: "communication",
    label: "Communication",
    description: "Settlement and claim notifications",
    status: "partial",
    implementations: ["Resend"],
    modules: ["lib/earn"],
  },
  {
    id: "ai_reasoning",
    label: "AI reasoning",
    description: "Evidence-backed capital recommendations across ecosystems",
    status: "partial",
    implementations: ["Gemini", "Llama", "OpenRouter"],
    modules: ["lib/ai", "lib/workspace/advisors", "api/workspace/ask"],
  },
  {
    id: "payments",
    label: "Payments",
    description: "Authorization lifecycle, claims, fulfillment",
    status: "partial",
    implementations: ["Circle", "Arc Gateway"],
    modules: ["lib/authorization", "lib/treasury", "lib/payment"],
  },
  {
    id: "graph_analysis",
    label: "Graph analysis",
    description: "Traverse dependencies, communities, value chains",
    status: "planned",
    implementations: ["Internal graph engine (Layer 4)"],
    modules: ["lib/domain"],
  },
  {
    id: "semantic_search",
    label: "Semantic search",
    description: "Mission and entity search across the value graph",
    status: "planned",
    implementations: ["Internal semantic search (Layer 2)"],
    modules: [],
  },
  {
    id: "treasury_management",
    label: "Treasury management",
    description: "Balances, obligations, funding gaps",
    status: "partial",
    implementations: ["Internal treasury engine", "Circle wallets"],
    modules: ["lib/treasury"],
  },
  {
    id: "policy_engine",
    label: "Policy engine",
    description: "Community-defined allocation rules and simulations",
    status: "partial",
    implementations: ["Internal policy proposals"],
    modules: ["lib/workspace/founder-presets", "lib/workspace/advisors"],
  },
  {
    id: "allocation_simulation",
    label: "Allocation simulation",
    description: "What-if capital deployment across graph",
    status: "planned",
    implementations: ["Internal simulation (Layer 2 + 5)"],
    modules: [],
  },
];

export function getCapability(id: CapabilityId): Capability | undefined {
  return CAPABILITIES.find((c) => c.id === id);
}

export function liveCapabilities(): Capability[] {
  return CAPABILITIES.filter((c) => c.status === "live" || c.status === "partial");
}
