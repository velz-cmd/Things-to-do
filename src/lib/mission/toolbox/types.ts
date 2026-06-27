/** Capital infrastructure primitives — each item is a capability, not a page. */

export type ToolboxSectionId =
  | "library"
  | "projects"
  | "observatories"
  | "policies"
  | "agents"
  | "automations"
  | "vaults"
  | "knowledge"
  | "developers";

export type CommunityDna = {
  health: number;
  velocity: number;
  funding: number;
  busFactor: number;
  research: number;
  community: number;
  risk: number;
};

export type EconomicProject = {
  id: string;
  name: string;
  kind: "ecosystem" | "repository" | "dao" | "foundation" | "research";
  tagline: string;
  watching: {
    repos: number;
    maintainers: number;
    discussions: number;
    papers: number;
    fundingPools: number;
  };
  status: {
    risk: "low" | "medium" | "high";
    funding: "strong" | "weak" | "critical";
    growth: "low" | "medium" | "high";
  };
  dna: CommunityDna;
  repoFullName?: string;
};

export type ObservatoryPulse = {
  id: string;
  text: string;
  severity: "critical" | "watch" | "positive";
  at: string;
};

export type Observatory = {
  id: string;
  name: string;
  domains: string[];
  pulses: ObservatoryPulse[];
  watching: number;
};

export type EconomicAgent = {
  id: string;
  name: string;
  scope: string;
  status: "active" | "idle" | "alert";
  metric: string;
  detail: string;
};

export type AutomationRule = {
  id: string;
  trigger: string;
  action: string;
  enabled: boolean;
};

export type CapitalVault = {
  id: string;
  name: string;
  purpose: string;
  balanceUsd: number;
  rules: string[];
  owners: string;
  readiness: "ready" | "partial" | "blocked";
};

export type PolicyPhilosophy = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  active: boolean;
};

export type KnowledgeArtifact = {
  id: string;
  title: string;
  kind: "decision" | "report" | "governance" | "research";
  source: string;
  at: string;
};

export type MissionLibraryEntry = {
  id: string;
  title: string;
  query: string;
  savedAt: string;
  findingCount?: number;
};

export type DeveloperSurface = {
  id: string;
  label: string;
  href: string;
  description: string;
};

export type ToolboxSnapshot = {
  gatheredAt: string;
  library: MissionLibraryEntry[];
  projects: EconomicProject[];
  observatories: Observatory[];
  policies: PolicyPhilosophy[];
  agents: EconomicAgent[];
  automations: AutomationRule[];
  vaults: CapitalVault[];
  knowledge: KnowledgeArtifact[];
  developers: DeveloperSurface[];
};
