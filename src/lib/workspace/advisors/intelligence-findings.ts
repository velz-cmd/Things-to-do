import type { WorkspaceEvidence } from "@/lib/workspace/context";
import type { MissionIntent } from "@/lib/mission/intents";
import type { FundingOpportunity } from "@/lib/github/types";

export type FindingSeverity = "critical" | "opportunity" | "info";

export type MissionFinding = {
  id: string;
  rank: number;
  severity: FindingSeverity;
  severityLabel: string;
  title: string;
  insight: string;
  impact?: string;
  bullets?: string[];
  metric?: { label: string; value: string };
  confidence: number;
  chips: string[];
};

function formatUsd(n: number, compact = false) {
  if (compact && n >= 1000) return `$${Math.round(n / 1000)}k`;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function ecosystemFromQuestion(question: string): string | null {
  const m = question.match(
    /\b(react|next\.?js|vue|angular|rust|python|langchain|supabase|navidrome|mastodon)\b/i,
  );
  return m ? m[1]! : null;
}

function filterOpportunities(opportunities: FundingOpportunity[], ecosystem: string | null) {
  if (!ecosystem) return opportunities;
  const q = ecosystem.toLowerCase();
  return opportunities.filter(
    (o) =>
      o.fullName.toLowerCase().includes(q) ||
      o.repo.toLowerCase().includes(q) ||
      (q.includes("react") && (o.fullName.includes("next") || o.repo.includes("react"))),
  );
}

function chipsForFinding(id: string): string[] {
  switch (id) {
    case "funding-gap":
      return ["Why?", "Show evidence", "Compare impact", "Explore"];
    case "observation-gap":
      return ["Reconnect sensor", "Show evidence", "Why?"];
    case "treasury-readiness":
      return ["Show breakdown", "Why?"];
    case "maintainer-risk":
      return ["Who maintains this?", "Show evidence", "Why?"];
    case "claimable-value":
      return ["Show breakdown", "Which ecosystems?", "Why?"];
    default:
      return ["Why?", "Show evidence", "Explore"];
  }
}

/** Ranked intelligence from live evidence — never connector documentation. */
export function buildIntelligenceFindings(
  evidence: WorkspaceEvidence,
  question: string,
  intent: MissionIntent,
): MissionFinding[] {
  const findings: MissionFinding[] = [];
  const ecosystem = ecosystemFromQuestion(question);
  const opps = filterOpportunities(evidence.opportunities, ecosystem);
  const github = evidence.connectors.find((c) => c.id === "github");

  const totalGap = opps.reduce((s, o) => s + o.health.fundingGapUsd, 0);
  const criticalOpps = opps.filter((o) => o.priority === "critical" || o.priority === "high");

  if (totalGap > 0 && (intent === "discovery" || intent === "funding" || intent === "risk")) {
    const label = ecosystem ? `${ecosystem} infrastructure` : "Connected infrastructure";
    const topNames = criticalOpps.slice(0, 3).map((o) => o.fullName);
    findings.push({
      id: "funding-gap",
      rank: 0,
      severity: criticalOpps.some((o) => o.priority === "critical") ? "critical" : "opportunity",
      severityLabel: criticalOpps.some((o) => o.priority === "critical") ? "Critical" : "Opportunity",
      title: label,
      insight: `${label} has ${formatUsd(totalGap, true)} of unfunded maintenance demand across ${opps.length} observed project${opps.length === 1 ? "" : "s"}.`,
      impact: "Underfunded maintainers increase ecosystem fragility.",
      bullets: topNames.length ? topNames : undefined,
      metric: { label: "Funding gap", value: formatUsd(totalGap) },
      confidence: opps.every((o) => o.live) ? 96 : 82,
      chips: chipsForFinding("funding-gap"),
    });
  }

  const criticalMaintainer = opps.find(
    (o) => o.priority === "critical" && o.health.maintainerCount <= 2,
  );
  if (criticalMaintainer && intent !== "claim") {
    const m = criticalMaintainer.health.maintainerCount;
    findings.push({
      id: "maintainer-risk",
      rank: 0,
      severity: "critical",
      severityLabel: "Critical",
      title: criticalMaintainer.fullName,
      insight: `${criticalMaintainer.fullName} depends on only ${m} active maintainer${m === 1 ? "" : "s"} while carrying ${criticalMaintainer.stars.toLocaleString()} stars of downstream dependency.`,
      impact: `If maintainer activity stops, ${criticalMaintainer.forks.toLocaleString()}+ forks face elevated risk.`,
      confidence: 91,
      chips: chipsForFinding("maintainer-risk"),
    });
  }

  if (github && github.health !== "healthy") {
    const reasons: string[] = [];
    if (github.health === "offline") reasons.push("Observation disconnected");
    if (github.health === "waiting") reasons.push("No activity observed in 24h");
    if (github.health === "syncing") reasons.push("Sync in progress");
    reasons.push("Repository may be inactive", "Access may need renewal");

    findings.push({
      id: "observation-gap",
      rank: 0,
      severity: "critical",
      severityLabel: "Critical",
      title: "Observation gap",
      insight: "RESOLVE hasn't observed contributor activity in the last 24 hours.",
      impact: "You may be missing recognition and funding signals in connected ecosystems.",
      bullets: reasons.slice(0, 3).map((r) => r.replace(/GitHub|Sensor/gi, "Ecosystem")),
      confidence: github.health === "offline" ? 93 : 87,
      chips: chipsForFinding("observation-gap"),
    });
  } else if (github && github.eventsToday === 0 && github.authorizationCount === 0) {
    findings.push({
      id: "observation-gap",
      rank: 0,
      severity: "opportunity",
      severityLabel: "Opportunity",
      title: "Observation gap",
      insight: "Ecosystem observation is online but no contribution events were captured today.",
      impact: "Value may exist in communities RESOLVE is not yet watching closely.",
      bullets: ["Expand observed repositories", "Verify permissions are current"],
      confidence: 85,
      chips: chipsForFinding("observation-gap"),
    });
  }

  const { treasury, ledger } = evidence;
  if (treasury.obligationsUsd > 0) {
    const pct =
      treasury.balanceUsd > 0 ?
        Math.min(100, (treasury.balanceUsd / treasury.obligationsUsd) * 100)
      : 0;
    const readiness =
      pct >= 100 ? "Ready"
      : pct >= 50 ? "Partial"
      : "Not ready";

    if (intent === "discovery" || intent === "funding" || intent === "general") {
      findings.push({
        id: "treasury-readiness",
        rank: 0,
        severity: pct < 10 ? "critical" : "info",
        severityLabel: "Treasury",
        title: "Settlement readiness",
        insight:
          pct < 100 ?
            `Treasury can settle only ${pct < 1 ? pct.toFixed(2) : Math.round(pct)}% of outstanding obligations.`
          : "Treasury is fully funded for current obligations.",
        metric: { label: "Readiness", value: readiness },
        bullets: [
          `Current treasury: ${formatUsd(treasury.balanceUsd)}`,
          `Outstanding obligations: ${formatUsd(treasury.obligationsUsd)}`,
        ],
        confidence: 100,
        chips: chipsForFinding("treasury-readiness"),
      });
    }
  }

  if (intent === "claim" && ledger && ledger.claimableUsd > 0) {
    findings.push({
      id: "claimable-value",
      rank: 0,
      severity: "opportunity",
      severityLabel: "Opportunity",
      title: "Unclaimed value",
      insight: `You've generated ${formatUsd(ledger.claimableUsd)} across connected ecosystems that hasn't been claimed.`,
      metric: { label: "Claimable", value: formatUsd(ledger.claimableUsd) },
      confidence: 98,
      chips: chipsForFinding("claimable-value"),
    });
  }

  return findings
    .sort((a, b) => {
      const sev = { critical: 0, opportunity: 1, info: 2 };
      const sd = sev[a.severity] - sev[b.severity];
      if (sd !== 0) return sd;
      return b.confidence - a.confidence;
    })
    .map((f, i) => ({ ...f, rank: i + 1 }));
}

export function buildIntelligenceHeadline(findings: MissionFinding[]): string {
  if (!findings.length) {
    return "No critical issues detected in connected ecosystems right now.";
  }
  if (findings.length === 1) {
    return "I found 1 thing that needs attention.";
  }
  return `I found ${findings.length} things that need attention.`;
}

export function rankLabel(rank: number): string {
  if (rank === 1) return "Today's biggest discovery";
  if (rank === 2) return "Second discovery";
  if (rank === 3) return "Third discovery";
  return `Discovery ${rank}`;
}
