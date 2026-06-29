/**
 * Layer 1 — The Brain
 *
 * Canonical entity kinds in RESOLVE. Everything in the platform is modeled as
 * entities and relationships — not pages, tabs, or connector dashboards.
 *
 * @see docs/ARCHITECTURE.md
 */

/** Frozen entity taxonomy. Extend only via architecture decision record. */
export type EntityType =
  | "person"
  | "identity"
  | "community"
  | "organization"
  | "project"
  | "repository"
  | "package"
  | "dependency"
  | "creator"
  | "work"
  | "treasury"
  | "policy"
  | "connector"
  | "observation"
  | "authorization"
  | "settlement"
  | "claim"
  | "wallet"
  | "funding_pool"
  | "opportunity"
  | "value_flow"
  | "agent"
  | "workflow";

/** Subtypes for Work — song, paper, article, dataset, asset, etc. */
export type WorkKind =
  | "song"
  | "album"
  | "paper"
  | "article"
  | "dataset"
  | "asset"
  | "recording"
  | "documentation"
  | "other";

/** Lightweight reference — graph nodes and observations use refs, not full records. */
export type EntityRef = {
  type: EntityType;
  /** Canonical ID, e.g. repo:vercel/next.js, person:github:octocat, work:mbid:… */
  id: string;
  label?: string;
  workKind?: WorkKind;
};

/** Full entity record (persisted in Layer 4 graph store). */
export type Entity = EntityRef & {
  createdAt: string;
  updatedAt: string;
  /** Connector or internal source that first materialized this entity */
  sourceConnectorId?: string;
  /** Optional structured attributes — never connector-specific at top level */
  attributes?: Record<string, string | number | boolean>;
};

/** Canonical ID builders — keep IDs stable across connectors. */
export const EntityIds = {
  opencollectiveProject: (slug: string) => `project:opencollective:${slug.toLowerCase()}`,
  personGitHub: (username: string) => `person:github:${username.toLowerCase()}`,
  personMusicBrainz: (mbid: string) => `person:musicbrainz:${mbid}`,
  personWallet: (address: string) => `person:wallet:${address.toLowerCase()}`,
  identity: (provider: string, externalId: string) =>
    `identity:${provider}:${externalId}`,
  repository: (owner: string, repo: string) => `repo:${owner}/${repo}`,
  packageNpm: (name: string) => `package:npm:${name}`,
  dependency: (fromId: string, toId: string) => `dep:${fromId}->${toId}`,
  workMusicBrainz: (recordingId: string) => `work:mbid:recording:${recordingId}`,
  workOpenAlex: (workId: string) => `work:openalex:${workId}`,
  community: (slug: string) => `community:${slug}`,
  organization: (slug: string) => `org:${slug}`,
  treasury: (id: string) => `treasury:${id}`,
  policy: (id: string) => `policy:${id}`,
  connector: (id: string) => `connector:${id}`,
  wallet: (address: string) => `wallet:${address.toLowerCase()}`,
  opportunity: (id: string) => `opportunity:${id}`,
} as const;

/** Human labels for entity types — UI reads these, never invents copy per connector. */
export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  person: "Person",
  identity: "Identity",
  community: "Community",
  organization: "Organization",
  project: "Project",
  repository: "Repository",
  package: "Package",
  dependency: "Dependency",
  creator: "Creator",
  work: "Work",
  treasury: "Treasury",
  policy: "Policy",
  connector: "Connector",
  observation: "Observation",
  authorization: "Authorization",
  settlement: "Settlement",
  claim: "Claim",
  wallet: "Wallet",
  funding_pool: "Funding Pool",
  opportunity: "Opportunity",
  value_flow: "Value Flow",
  agent: "Agent",
  workflow: "Workflow",
};

export function parseEntityRef(canonicalId: string): Pick<EntityRef, "type" | "id"> | null {
  if (canonicalId.startsWith("repo:")) {
    return { type: "repository", id: canonicalId };
  }
  if (canonicalId.startsWith("person:")) {
    return { type: "person", id: canonicalId };
  }
  if (canonicalId.startsWith("work:")) {
    return { type: "work", id: canonicalId };
  }
  if (canonicalId.startsWith("community:")) {
    return { type: "community", id: canonicalId };
  }
  if (canonicalId.startsWith("creator:")) {
    return { type: "creator", id: canonicalId };
  }
  const [prefix] = canonicalId.split(":");
  const typeMap: Record<string, EntityType> = {
    org: "organization",
    package: "package",
    dep: "dependency",
    treasury: "treasury",
    policy: "policy",
    connector: "connector",
    wallet: "wallet",
    opportunity: "opportunity",
    identity: "identity",
  };
  const type = typeMap[prefix];
  return type ? { type, id: canonicalId } : null;
}
