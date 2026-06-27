import type { OrchestratorContext } from "@/lib/mission/capabilities/types";
import type { MissionFinding } from "@/lib/workspace/advisors/intelligence-findings";
import type { CapabilityAction } from "@/lib/mission/capabilities/types";
import type { FundingOpportunity } from "@/lib/github/types";
import { LAYER_LABELS } from "@/lib/mission/community";
import type { CapabilityLayer } from "@/lib/mission/community";
import { normalizeConfidence } from "@/lib/mission/normalize-confidence";

export type BriefSeverity = "critical" | "high" | "medium" | "low" | "info";

export type IntelligenceBrief = {
  headline: string;
  summary: string;
  capability: string;
  capabilityLabel: string;
  findingCount: number;
  priority?: {
    label: string;
    ecosystem?: string;
    severity: BriefSeverity;
    confidence: number;
    reason: string;
  };
  impact?: {
    label: string;
    value: string;
  };
  funding?: {
    neededUsd?: number;
    availableUsd?: number;
    deployUsd?: number;
  };
  options: Array<{ id: string; label: string; detail?: string }>;
  evidence: string[];
  simulations?: Array<{ label: string; value: string }>;
  recommendations: Array<{ label: string; detail: string }>;
  actions: CapabilityAction[];
  findings: MissionFinding[];
};

function formatUsd(n: number, compact = false) {
  if (compact && n >= 1000) return `$${Math.round(n / 1000)}k`;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function severityFromFinding(f: MissionFinding): BriefSeverity {
  if (f.severity === "critical") return "critical";
  if (f.id === "funding-gap") return "high";
  return "medium";
}

function evidenceFromTraces(ctx: OrchestratorContext): string[] {
  const layers = new Set<string>();
  for (const t of ctx.traces) {
    if (t.status !== "ok") continue;
    if (t.layer) {
      layers.add(LAYER_LABELS[t.layer]);
      continue;
    }
    const fallback: Record<string, CapabilityLayer> = {
      github: "observe",
      openalex: "observe",
      upstream: "understand",
      treasury: "capital",
      ledger: "attribute",
      connectors: "observe",
      music: "observe",
      policies: "understand",
      concentrations: "understand",
    };
    const layer = fallback[t.source];
    if (layer) layers.add(LAYER_LABELS[layer]);
  }
  if (ctx.community.kindLabel) layers.add(ctx.community.kindLabel);
  return [...layers];
}

function downstreamEstimate(o: FundingOpportunity): string {
  const deps = o.forks > 0 ? o.forks : Math.round(o.stars / 4);
  return `${deps.toLocaleString()} downstream repositories`;
}

/** Bloomberg / Palantir-style structured brief — never essay prose. */
export function buildIntelligenceBrief(ctx: OrchestratorContext): IntelligenceBrief {
  const { capability, findings, opportunities, capitalUsd, communityName, community } = ctx;
  const totalGap = opportunities.reduce((s, o) => s + o.health.fundingGapUsd, 0);
  const top = findings[0];
  const topOpp = opportunities[0];
  const evidence = evidenceFromTraces(ctx);
  const scope = ctx.communityName ?? ctx.community.name ?? ctx.community.kindLabel;

  const base: IntelligenceBrief = {
    headline: "",
    summary: "",
    capability,
    capabilityLabel: ctx.capabilityLabel,
    findingCount: findings.length,
    options: [],
    evidence,
    recommendations: [],
    actions: [],
    findings,
  };

  switch (capability) {
    case "discover_value_leaks": {
      const count = opportunities.filter((o) => o.health.fundingGapUsd > 0).length || findings.length;
      base.headline = count > 0 ?
        `I found ${count} area${count === 1 ? "" : "s"} where capital would have the greatest impact`
      : "No major funding gaps at current scan depth";
      base.summary =
        count > 0 ?
          `${formatUsd(totalGap, true)} unfunded maintenance demand across ${scope}.`
        : `Observed ${scope} shows no major unfunded gaps at current scan depth.`;

      if (top && topOpp) {
        base.priority = {
          label: top.title,
          ecosystem: scope,
          severity: severityFromFinding(top),
          confidence: top.confidence,
          reason: top.insight,
        };
        base.impact = {
          label: "Estimated downstream exposure",
          value: downstreamEstimate(topOpp),
        };
        base.funding = { neededUsd: topOpp.health.fundingGapUsd };
        base.options = [
          { id: "maintainer", label: "Support maintainer", detail: topOpp.fullName },
          { id: "contributors", label: "Expand contributor base" },
          { id: "docs", label: "Fund documentation" },
        ];
      }
      base.recommendations = findings.slice(0, 3).map((f) => ({
        label: f.title,
        detail: f.insight,
      }));
      break;
    }

    case "allocate_capital": {
      const amount = capitalUsd ?? 100_000;
      base.headline = `Allocation plan · ${formatUsd(amount)}`;
      base.summary = `${opportunities.length} repositories weighted by live funding gaps in ${scope}.`;
      base.funding = {
        deployUsd: amount,
        availableUsd: ctx.evidence.treasury.balanceUsd,
        neededUsd: totalGap,
      };
      if (topOpp) {
        base.priority = {
          label: topOpp.fullName,
          ecosystem: scope,
          severity: topOpp.priority === "critical" ? "critical" : "high",
          confidence: top?.confidence ?? 0.88,
          reason: `${topOpp.health.maintainerCount} maintainer(s) · ${formatUsd(topOpp.health.fundingGapUsd)} gap`,
        };
      }
      base.simulations = opportunities.slice(0, 4).map((o) => {
        const gapTotal = totalGap || 1;
        const amt = Math.round((o.health.fundingGapUsd / gapTotal) * amount * 0.85);
        return { label: o.fullName, value: formatUsd(amt) };
      });
      base.recommendations = ctx.policies.slice(0, 3).map((p) => ({
        label: p.label,
        detail: p.description,
      }));
      break;
    }

    case "compare_ecosystems": {
      const [a, b] = ctx.compareTargets;
      base.headline = a && b ? `${a} vs ${b}` : "Ecosystem comparison";
      base.summary = `Side-by-side economic signals from live repository scans.`;
      base.recommendations = opportunities.slice(0, 2).map((o) => ({
        label: o.fullName,
        detail: `${formatUsd(o.health.fundingGapUsd)} gap · ${o.stars.toLocaleString()} stars`,
      }));
      break;
    }

    case "assess_risk": {
      base.headline = top ? `Critical risk · ${top.title}` : "Risk assessment";
      base.summary = top?.insight ?? "No critical bus-factor risk in observed repositories.";
      if (top && topOpp) {
        base.priority = {
          label: top.title,
          severity: "critical",
          confidence: top.confidence,
          reason: top.insight,
        };
        base.impact = { label: "Blast radius", value: downstreamEstimate(topOpp) };
      }
      break;
    }

    case "claim_value": {
      const claimable = ctx.evidence.ledger?.claimableUsd ?? 0;
      base.headline = claimable > 0 ? `${formatUsd(claimable)} claimable` : "No claimable value";
      base.summary =
        claimable > 0 ?
          `${ctx.evidence.ledger!.count} authorization${ctx.evidence.ledger!.count === 1 ? "" : "s"} ready.`
        : "Connect ecosystems so contributions can be recognized.";
      base.funding = { availableUsd: claimable };
      break;
    }

    case "execute_settlement": {
      base.headline = "Settlement review";
      base.summary = ctx.evidence.treasury.canSettleGlobally ?
        "Treasury ready — review recipients and amounts."
      : `Blocked: ${ctx.evidence.treasury.blockers[0] ?? "treasury underfunded"}`;
      base.funding = {
        availableUsd: ctx.evidence.treasury.balanceUsd,
        neededUsd: ctx.evidence.ledger?.pendingFundingUsd,
      };
      break;
    }

    default: {
      const findingCount = findings.length || opportunities.length;
      base.headline =
        findingCount > 0 ?
          `${findingCount} signal${findingCount === 1 ? "" : "s"} in ${scope}`
        : top?.title ?? ctx.capabilityLabel;
      base.summary =
        findings.length > 0 ?
          findings
            .slice(0, 2)
            .map((f) => f.insight)
            .join(" ")
        : top?.insight ?? `Live scan across ${scope}.`;
      if (top) {
        base.priority = {
          label: top.title,
          ecosystem: scope,
          severity: severityFromFinding(top),
          confidence: normalizeConfidence(top.confidence),
          reason: top.insight,
        };
      }
      base.recommendations = findings.slice(0, 3).map((f) => ({
        label: f.title,
        detail: f.insight,
      }));
    }
  }

  return base;
}
