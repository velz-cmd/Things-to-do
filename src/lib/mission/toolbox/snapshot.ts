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
  ObservatoryAlert,
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

  const maint = o.health.maintainerCount;
  const activity =
    maint <= 1 ?
      `${maint} active maintainer — elevated bus-factor risk`
    : `${maint} maintainers · ${o.highImpactPrs} high-impact changes tracked`;

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
    activity,
    capitalUsd: o.health.fundingGapUsd,
    missionCount: o.health.fundingGapUsd > 0 ? 1 : 0,
  };
}

const OBSERVATORY_PRESETS: { id: string; name: string; domains: string[]; match: RegExp }[] = [
  {
    id: "ai-infra",
    name: "AI Infrastructure",
    domains: ["repositories", "research", "releases"],
    match: /langchain|supabase|next/i,
  },
  {
    id: "open-source",
    name: "Open Source",
    domains: ["repositories", "releases", "security"],
    match: /navidrome|mastodon|immich|koel|owncast/i,
  },
  {
    id: "music",
    name: "Music & Media",
    domains: ["creators", "listening", "attribution"],
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
          `Funding gap widened · ${o.fullName} · $${Math.round(o.health.fundingGapUsd / 1000)}k unfunded`
        : `${o.health.headline}`,
      severity: (o.priority === "critical" ? "critical" : "watch") as ObservatoryPulse["severity"],
      at: evidence.gatheredAt,
    }));

    const github = evidence.connectors.find((c) => c.id === "github");
    if (preset.id === "open-source" && github && github.eventsToday === 0) {
      pulses.unshift({
        id: `${preset.id}-obs`,
        text: "Contributor activity dropped — no events in 24h",
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

function buildAlertStream(observatories: Observatory[]): ObservatoryAlert[] {
  const alerts: ObservatoryAlert[] = [];
  for (const obs of observatories) {
    for (const pulse of obs.pulses) {
      if (pulse.severity === "positive") continue;
      alerts.push({
        id: pulse.id,
        observatoryName: obs.name,
        text: pulse.text,
        severity: pulse.severity,
        at: pulse.at,
        query: `Explain what changed: ${pulse.text}`,
      });
    }
  }
  return alerts
    .sort((a, b) => {
      const sev = { critical: 0, watch: 1, positive: 2 };
      return sev[a.severity] - sev[b.severity];
    })
    .slice(0, 6);
}

function buildAgents(evidence: WorkspaceEvidence, opportunities: FundingOpportunity[]): EconomicAgent[] {
  const critical = opportunities.find((o) => o.priority === "critical");
  const totalGap = opportunities.reduce((s, o) => s + o.health.fundingGapUsd, 0);
  const { treasury, ledger } = evidence;
  const pct =
    treasury.obligationsUsd > 0 ?
      Math.min(100, (treasury.balanceUsd / treasury.obligationsUsd) * 100)
    : 100;

  return [
    {
      id: "treasury",
      name: "Treasury Agent",
      purpose: "Settlement readiness and obligation coverage",
      currentTask:
        pct < 100 ?
          "Preparing a settlement recommendation — obligations exceed available capital."
        : "Monitoring obligation coverage — treasury is fully funded.",
      lastCompletedTask: "Scanned outstanding obligations across connected ecosystems",
      confidence: 94,
      nextObservation: "Next scan in 15 minutes",
      status: pct < 10 ? "alert" : treasury.obligationsUsd > 0 ? "working" : "watching",
      query: "Explain the settlement tradeoff between paying now vs waiting.",
    },
    {
      id: "dependency",
      name: "Dependency Agent",
      purpose: "Transitive risk across observed repositories",
      currentTask:
        critical ?
          `Tracking critical dependency risk on ${critical.fullName}.`
        : `Watching ${opportunities.length} repositories for dependency concentration.`,
      lastCompletedTask: "Correlated maintainer activity with downstream fork exposure",
      confidence: critical ? 91 : 78,
      nextObservation: "Continuous",
      status: critical ? "alert" : opportunities.length > 0 ? "watching" : "idle",
      query: critical ?
        `Map downstream communities that depend on ${critical.fullName}.`
      : "Which libraries in my ecosystem carry the highest downstream risk?",
    },
    {
      id: "community",
      name: "Community Agent",
      purpose: "Maintainer burnout and contributor recognition",
      currentTask:
        (ledger?.count ?? 0) > 0 ?
          `Recognizing ${ledger!.count} participants — scanning for inactive maintainers.`
        : "Waiting for contributor signals to analyze community health.",
      lastCompletedTask: "Indexed maintainer activity patterns across repositories",
      confidence: (ledger?.count ?? 0) > 0 ? 86 : 60,
      nextObservation: "Hourly",
      status: (ledger?.count ?? 0) > 0 ? "working" : "idle",
      query: "Who are the most at-risk maintainers in my ecosystem?",
    },
    {
      id: "risk",
      name: "Risk Agent",
      purpose: "Cross-ecosystem correlation of funding gaps and bus factor",
      currentTask:
        totalGap > 0 ?
          `Correlating $${Math.round(totalGap / 1000)}k in funding gaps with bus-factor exposure.`
        : "Monitoring ecosystem stability — no elevated risk signals.",
      lastCompletedTask: "Ranked funding gaps against maintainer concentration",
      confidence: totalGap > 0 ? 88 : 72,
      nextObservation: "Every 30 minutes",
      status: totalGap > 50000 ? "alert" : totalGap > 0 ? "watching" : "idle",
      query: "Rank where capital would reduce the most ecosystem risk.",
    },
  ];
}

const AUTOMATION_TEMPLATES: AutomationRule[] = [
  {
    id: "maintainer-inactive",
    trigger: "Maintainer inactive 90 days",
    action: "Surface in Mission and prepare rescue simulation",
    enabled: true,
    lastFired: undefined,
  },
  {
    id: "treasury-threshold",
    trigger: "Treasury exceeds target balance",
    action: "Start allocation simulation",
    enabled: false,
  },
  {
    id: "funding-gap",
    trigger: "Funding gap increases > 30%",
    action: "Notify Mission with updated ranking",
    enabled: true,
  },
  {
    id: "contributor-threshold",
    trigger: "Contributor reaches recognition threshold",
    action: "Prepare payout recommendation",
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
      rules: ["Evidence-backed authorization only"],
      owners: "Operator",
      readiness,
    },
    {
      id: "obligations",
      name: "Obligations Pool",
      purpose: "Authorized value awaiting fulfillment",
      balanceUsd: obligations,
      rules: ["Treasury-funded settlement"],
      owners: "Ledger",
      readiness: obligations > bal ? "blocked" : "partial",
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
      source: "Ecosystem analysis",
      at: evidence.gatheredAt,
    });
  }
  if (evidence.ledger && evidence.ledger.count > 0) {
    items.push({
      id: "k-ledger",
      title: `${evidence.ledger.count} recognized participants · $${evidence.ledger.authorizedUsd.toFixed(0)} authorized`,
      kind: "decision",
      source: "Recognition history",
      at: evidence.gatheredAt,
    });
  }
  return items;
}

const DEVELOPER_SURFACES: DeveloperSurface[] = [
  { id: "api", label: "REST API", href: "/api/workspace/overview", description: "Workspace intelligence" },
  { id: "ask", label: "Mission API", href: "/api/workspace/ask", description: "Evidence-backed reasoning" },
  { id: "toolbox", label: "Systems API", href: "/api/mission/toolbox", description: "Living systems snapshot" },
];

const POLICY_INFLUENCES: Record<string, string> = {
  infrastructure: "Prioritizes maintainers and critical infrastructure in allocation reasoning",
  growth: "Biases toward builders, documentation, and ecosystem expansion",
  balanced: "Weights all value categories equally in recommendations",
  bugs: "Elevates security patches and stability in risk scoring",
  community: "Favors community operations and contributor recognition",
};

export function buildToolboxSnapshot(
  evidence: WorkspaceEvidence,
  library: ToolboxSnapshot["library"] = [],
): ToolboxSnapshot {
  const opportunities = evidence.opportunities;
  const projects = opportunities.slice(0, 6).map(projectFromOpportunity);
  const observatories = buildObservatories(evidence, opportunities);
  const policies: PolicyPhilosophy[] = buildPolicyProposals(evidence).map((p) => ({
    id: p.id,
    name: p.label,
    emoji: p.emoji,
    description: p.description,
    active: p.id === "infrastructure" || p.id === "balanced",
    influences: POLICY_INFLUENCES[p.id] ?? "Influences allocation reasoning",
  }));

  return {
    gatheredAt: evidence.gatheredAt,
    library,
    projects,
    observatories,
    alerts: buildAlertStream(observatories),
    policies,
    agents: buildAgents(evidence, opportunities),
    automations: AUTOMATION_TEMPLATES,
    vaults: buildVaults(evidence),
    knowledge: buildKnowledge(evidence, opportunities),
    developers: DEVELOPER_SURFACES,
  };
}
