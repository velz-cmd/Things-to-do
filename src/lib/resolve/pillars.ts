/**
 * RESOLVE permanent pillars — layered infrastructure, never replaced.
 * Distribution → Attribution → Authorization → Intelligence → Policies
 * → Capital Flow → Settlement → Workspace
 *
 * New features attach to a layer. Nothing deletes a previous layer.
 */

export const RESOLVE_MISSION =
  "RESOLVE discovers, authorizes, routes, and settles value across open ecosystems.";

export type PillarId =
  | "distribution"
  | "attribution"
  | "authorization"
  | "intelligence"
  | "policies"
  | "capital_flow"
  | "settlement"
  | "workspace";

export type Pillar = {
  id: PillarId;
  label: string;
  tagline: string;
  /** Code modules that implement this pillar */
  modules: string[];
};

/** Eight layers — same pipeline, additive forever. */
export const PILLARS: Pillar[] = [
  {
    id: "distribution",
    label: "Distribution",
    tagline: "Attach beside communities — never build audiences.",
    modules: ["connectors", "integrations", "navidrome-sync", "listenbrainz-sync"],
  },
  {
    id: "attribution",
    label: "Attribution",
    tagline: "Read existing graphs — git blame, MusicBrainz, OpenAlex, Libraries.io.",
    modules: ["github/workers", "attribution/musicbrainz", "attribution/listenbrainz"],
  },
  {
    id: "authorization",
    label: "Authorization",
    tagline: "Value happened — recognize immediately. Owed → pending → claimable → settled.",
    modules: ["authorization/ledger", "earn/notify"],
  },
  {
    id: "intelligence",
    label: "Intelligence",
    tagline: "Discover opportunities, evidence, leaks — never replace attribution.",
    modules: ["ai/gateway", "github/opportunities", "workspace/advisors"],
  },
  {
    id: "policies",
    label: "Policies",
    tagline: "Communities define splits — RESOLVE executes, never decides.",
    modules: ["workspace/founder-presets", "payment/orchestrator"],
  },
  {
    id: "capital_flow",
    label: "Capital Flow",
    tagline: "Route treasury to 10k–100k participants — one batch, low fees, cross-border.",
    modules: ["treasury/engine", "settlement/global", "settlement/fx"],
  },
  {
    id: "settlement",
    label: "Settlement",
    tagline: "Arc · Circle · wallets · batching · claims · notifications.",
    modules: ["payment/orchestrator", "arc/memo", "claim/tokens"],
  },
  {
    id: "workspace",
    label: "Workspace",
    tagline: "One operating system for open value — observe, decide, act.",
    modules: ["workspace/overview", "workspace/advisors", "workspace-os-dashboard"],
  },
];

export const PIPELINE_ORDER: PillarId[] = [
  "distribution",
  "attribution",
  "authorization",
  "intelligence",
  "policies",
  "capital_flow",
  "settlement",
  "workspace",
];
