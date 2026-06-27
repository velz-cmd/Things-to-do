import type { WorkspaceEvidence } from "@/lib/workspace/context";
import { buildPolicyProposals } from "@/lib/workspace/advisors/policy-proposals";
import type {
  AutomationRule,
  CapitalVault,
  EconomicAgent,
  CommunityDna,
  DeveloperSurface,
  EconomicProject,
  KnowledgeArtifact,
  Observatory,
  ObservatoryPulse,
  PolicyPhilosophy,
  ToolboxSnapshot,
} from "@/lib/mission/toolbox/types";
import type { FundingOpportunity } from "@/lib/github/types";

function dnaFromOpportunity(o: FundingOpportunity): CommunityDna {
  const h = o.health;
  const fundingScore = Math.max(0, Math.min(100, 100 - Math.min(100, h.fundingGapUsd / 2000)));
  const busFactor = Math.max(0, Math.min(100, h.maintainerCount * 35));
  const velocity = Math.max(20, Math.min(95, h.score));
  const risk = Math.max(0, Math.min(100, 100 - h.score + (h.maintainerCount <= 1 ? 25 : 0)));

  return {
    health: h.score,
    velocity,
    funding: Math.round(fundingScore),
    busFactor: Math.round(busFactor),
    research: o.stars > 5000 ? 71 : 45,
    community: Math.min(95, Math.round(Math.log10(o.stars + 1) * 22)),
    risk: Math.round(risk),
  };
}

function projectFromOpportunity(o: FundingOpportunity): EconomicProject {
  const risk: EconomicProject["status"]["risk"] =
    o.priority === "critical" ? "high" : o.priority === "high" ? "medium" : "low";
  const funding: EconomicProject["status"]["funding"] =
    o.health.fundingGapUsd > 100000 ? "critical"
    : o.health.fundingGapUsd > 20000 ? "weak"
    : "strong";
  const growth: EconomicProject["status"]["growth"] =
    o.stars > 20000 ? "high" : o.stars > 5000 ? "medium" : "low";

  return {
    id: o.id,
    name: o.fullName,
    kind: "repository",
    tagline: o.headline,
    watching: {
      repos: 1 + Math.min(12, Math.round(o.forks / 500)),
      maintainers: o.health.maintainerCount,
      discussions: o.highImpactPrs,
      papers: 0,
      fundingPools: o.health.fundingGapUsd > 0 ? 1 : 0,
    },
    status: { risk, funding, growth },
    dna: dnaFromOpportunity(o),
    repoFullName: o.fullName,
  };
}

const OBSERVATORY_PRESETS: { id: string; name: string; domains: string[]; match: RegExp }[] = [
  {
    id: "ai-infra",
    name: "AI Infrastructure",
    domains: ["GitHub", "OpenAlex", "Papers"],
    match: /langchain|supabase|next/i,
  },
  {
    id: "open-source",
    name: "Open Source",
    domains: ["GitHub", "Releases", "CVEs"],
    match: /navidrome|mastodon|immich|koel|owncast/i,
  },
  {
    id: "music",
    name: "Music & Media",
    domains: ["Navidrome", "ListenBrainz", "RSS"],
    match: /navidrome|koel|music/i,
  },
];

function buildObservatories(
  evidence: WorkspaceEvidence,
  opportunities: FundingOpportunity[],
): Observatory[] {
  return OBSERVATORY_PRESETS.map((preset) => {
    const matched = opportunities.filter((o) => preset.match.test(o.fullName));
    const pulses = matched.slice(0, 4).map((o, i) => ({
      id: `${preset.id}-${i}`,
      text:
        o.priority === "critical" ?
          `Funding gap increased · ${o.fullName} · $${Math.round(o.health.fundingGapUsd / 1000)}k`
        : `${o.health.headline}`,
      severity: (o.priority === "critical" ? "critical" : "watch") as ObservatoryPulse["severity"],
      at: evidence.gatheredAt,
    }));

    const github = evidence.connectors.find((c) => c.id === "github");
    if (preset.id === "open-source" && github && github.eventsToday === 0) {
      pulses.unshift({
        id: `${preset.id}-obs`,
        text: "Observation gap · no GitHub events in 24h",
        severity: "critical",
        at: evidence.gatheredAt,
      });
    }

    return {
      id: preset.id,
      name: preset.name,
      domains: preset.domains,
      pulses: pulses.slice(0, 5),
      watching: matched.length + (github?.authorizationCount ?? 0),
    };
  });
}

function buildAgents(evidence: WorkspaceEvidence, repoCount: number): EconomicAgent[] {
  const github = evidence.connectors.find((c) => c.id === "github");
  const music = evidence.connectors.find((c) => c.id === "navidrome");

  return [
    {
      id: "dependency",
      name: "Dependency Agent",
      scope: `${repoCount} repos · ${evidence.connectors.filter((c) => c.health === "healthy").length} ecosystems`,
      status: repoCount > 0 ? "active" : "idle",
      metric: github?.health === "healthy" ? "stable" : "alert",
      detail: "Watching transitive dependency risk across observed repositories.",
    },
    {
      id: "treasury",
      name: "Treasury Agent",
      scope: `$${evidence.treasury.balanceUsd.toFixed(0)} USDC`,
      status: evidence.treasury.canSettleGlobally ? "active" : "alert",
      metric:
        evidence.treasury.obligationsUsd > evidence.treasury.balanceUsd ? "underfunded" : "ready",
      detail: "Monitoring settlement readiness and obligation coverage.",
    },
    {
      id: "community",
      name: "Community Agent",
      scope: `${evidence.ledger?.count ?? 0} recognized participants`,
      status: (evidence.ledger?.count ?? 0) > 0 ? "active" : "idle",
      metric: "scanning",
      detail: "Tracking maintainer activity, burnout signals, and contributor recognition.",
    },
    {
      id: "research",
      name: "Research Agent",
      scope: "OpenAlex · citations",
      status: "idle",
      metric: "standby",
      detail: "Connect research sensors to trace paper → production influence.",
    },
    {
      id: "music",
      name: "Music Agent",
      scope: music ? `${music.authorizationCount} authorizations` : "not connected",
      status: music?.health === "healthy" ? "active" : "idle",
      metric: music?.eventsToday ? `${music.eventsToday} events today` : "waiting",
      detail: "Observing listen attribution and unpaid creator value.",
    },
    {
      id: "risk",
      name: "Risk Agent",
      scope: "Cross-ecosystem",
      status: "active",
      metric: evidence.treasury.blockers.length ? "elevated" : "normal",
      detail: "Correlating funding gaps, bus factor, and observation blind spots.",
    },
  ];
}

const AUTOMATION_TEMPLATES: AutomationRule[] = [
  {
    id: "maintainer-inactive",
    trigger: "Maintainer inactive 90 days",
    action: "Notify DAO + surface in Observatory",
    enabled: true,
  },
  {
    id: "treasury-threshold",
    trigger: "Treasury exceeds $500k",
    action: "Start allocation simulation",
    enabled: false,
  },
  {
    id: "funding-gap",
    trigger: "Funding gap increases > 30%",
    action: "Generate proposal draft",
    enabled: true,
  },
  {
    id: "contributor-threshold",
    trigger: "Contributor reaches recognition threshold",
    action: "Prepare payout authorization",
    enabled: true,
  },
];

function buildVaults(evidence: WorkspaceEvidence): CapitalVault[] {
  const bal = evidence.treasury.balanceUsd;
  const obligations = evidence.treasury.obligationsUsd;
  const readiness: CapitalVault["readiness"] =
    evidence.treasury.canSettleGlobally ? "ready"
    : bal > 0 ? "partial"
    : "blocked";

  return [
    {
      id: "oss-treasury",
      name: "OSS Treasury",
      purpose: "Global settlement for recognized open-source value",
      balanceUsd: bal,
      rules: ["Batch Arc settlement", "Evidence-backed authorization only"],
      owners: "Operator",
      readiness,
    },
    {
      id: "obligations",
      name: "Obligations Pool",
      purpose: "Authorized value awaiting fulfillment",
      balanceUsd: obligations,
      rules: ["FIFO settlement", "Treasury-funded"],
      owners: "Ledger",
      readiness: obligations > bal ? "blocked" : "partial",
    },
    {
      id: "emergency",
      name: "Emergency Fund",
      purpose: "Critical maintainer or bus-factor rescue",
      balanceUsd: Math.max(0, bal * 0.1),
      rules: ["DAO approval required", "72h cooldown"],
      owners: "Governance",
      readiness: bal > 100 ? "partial" : "blocked",
    },
    {
      id: "grants",
      name: "Grants Pool",
      purpose: "Retroactive and proactive ecosystem grants",
      balanceUsd: 0,
      rules: ["Quadratic optional", "Policy-driven splits"],
      owners: "Foundation",
      readiness: "blocked",
    },
  ];
}

function buildKnowledge(
  evidence: WorkspaceEvidence,
  opportunities: FundingOpportunity[],
): KnowledgeArtifact[] {
  const items: KnowledgeArtifact[] = [];
  for (const o of opportunities.slice(0, 3)) {
    items.push({
      id: `k-${o.id}`,
      title: `${o.fullName} · ${o.health.headline}`,
      kind: "report",
      source: "Dependency scan",
      at: evidence.gatheredAt,
    });
  }
  if (evidence.ledger && evidence.ledger.count > 0) {
    items.push({
      id: "k-ledger",
      title: `${evidence.ledger.count} authorizations · $${evidence.ledger.authorizedUsd.toFixed(0)} recognized`,
      kind: "decision",
      source: "Authorization ledger",
      at: evidence.gatheredAt,
    });
  }
  return items;
}

const DEVELOPER_SURFACES: DeveloperSurface[] = [
  { id: "api", label: "REST API", href: "/api/workspace/overview", description: "Workspace intelligence" },
  { id: "ask", label: "Mission API", href: "/api/workspace/ask", description: "Evidence-backed reasoning" },
  { id: "toolbox", label: "Toolbox API", href: "/api/mission/toolbox", description: "Infrastructure snapshot" },
  { id: "connectors", label: "Connectors", href: "/api/connectors/live", description: "Sensor health" },
  { id: "payments", label: "Capital API", href: "/api/payments/overview", description: "Treasury + ledger" },
  { id: "profile", label: "Connect sensors", href: "/profile", description: "Attach ecosystems" },
];

export function buildToolboxSnapshot(
  evidence: WorkspaceEvidence,
  library: ToolboxSnapshot["library"] = [],
): ToolboxSnapshot {
  const opportunities = evidence.opportunities;
  const projects = opportunities.slice(0, 6).map(projectFromOpportunity);
  const policies: PolicyPhilosophy[] = buildPolicyProposals(evidence).map((p) => ({
    id: p.id,
    name: p.label,
    emoji: p.emoji,
    description: p.description,
    active: p.id === "infrastructure" || p.id === "balanced",
  }));

  return {
    gatheredAt: evidence.gatheredAt,
    library,
    projects,
    observatories: buildObservatories(evidence, opportunities),
    policies,
    agents: buildAgents(evidence, opportunities.length),
    automations: AUTOMATION_TEMPLATES,
    vaults: buildVaults(evidence),
    knowledge: buildKnowledge(evidence, opportunities),
    developers: DEVELOPER_SURFACES,
  };
}
