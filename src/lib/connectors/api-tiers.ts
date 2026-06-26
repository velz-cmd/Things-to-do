/**
 * Connector API tiers — what powers Distribution Connectors.
 * Keys live in Vercel env only (never in source).
 */
export type ConnectorTier = "tier1" | "tier2" | "upcoming";

export type ConnectorApiBinding = {
  id: string;
  label: string;
  tier: ConnectorTier;
  envKeys: string[];
  role: string;
};

export const CONNECTOR_API_BINDINGS: ConnectorApiBinding[] = [
  {
    id: "github-graphql",
    label: "GitHub GraphQL",
    tier: "tier1",
    envKeys: ["GITHUB_TOKEN"],
    role: "PRs, reviews, commits, repo graph",
  },
  {
    id: "github-rest",
    label: "GitHub REST",
    tier: "tier1",
    envKeys: ["GITHUB_TOKEN"],
    role: "Contributors, issues, releases, webhooks",
  },
  {
    id: "libraries-io",
    label: "Libraries.io",
    tier: "tier1",
    envKeys: ["LIBRARIES_IO_API_KEY"],
    role: "Downstream dependents, package ecosystems",
  },
  {
    id: "openalex",
    label: "OpenAlex",
    tier: "tier1",
    envKeys: ["OPENALEX_API_KEY"],
    role: "Citations, authors, research software",
  },
  {
    id: "blockscout",
    label: "Blockscout",
    tier: "tier1",
    envKeys: ["BLOCKSCOUT_API_KEY", "BLOCKSCOUT_CHAIN_ID"],
    role: "Settlement explorer, treasury transparency",
  },
  {
    id: "resend",
    label: "Resend",
    tier: "tier1",
    envKeys: ["RESEND_API_KEY", "RESEND_FROM_EMAIL"],
    role: "Earn notifications, claim links",
  },
  {
    id: "npm-registry",
    label: "npm Registry",
    tier: "tier2",
    envKeys: ["NPM_REGISTRY_TOKEN"],
    role: "Package downloads = usage signal",
  },
  {
    id: "docker-hub",
    label: "Docker Hub",
    tier: "tier2",
    envKeys: ["DOCKER_HUB_USERNAME", "DOCKER_HUB_TOKEN"],
    role: "Image pull counts = usage signal",
  },
  {
    id: "pypi",
    label: "PyPI JSON",
    tier: "tier2",
    envKeys: [],
    role: "Python package downloads (public API)",
  },
  {
    id: "gharchive",
    label: "GH Archive / BigQuery",
    tier: "tier2",
    envKeys: ["GHARCHIVE_BIGQUERY_PROJECT"],
    role: "Historical GitHub events at scale",
  },
];
