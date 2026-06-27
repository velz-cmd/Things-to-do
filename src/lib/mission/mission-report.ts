import type { CapabilityAction, OrchestratorContext } from "@/lib/mission/capabilities/types";
import type { IntelligenceBrief } from "@/lib/mission/intelligence-brief";
import type { MissionFinding } from "@/lib/workspace/advisors/intelligence-findings";
import { LAYER_LABELS } from "@/lib/mission/community";

export type MissionReportStatus = "complete" | "pending_approval" | "executing" | "failed";

export type MissionReportEvidenceLink = {
  label: string;
  href?: string;
  source: string;
};

export type MissionReport = {
  /** Public artifact id — shareable, auditable */
  reportId: string;
  missionId?: string;
  turnId?: string;
  /** Capability run, not "AI analysis" */
  capability: string;
  capabilityLabel: string;
  objective: string;
  status: MissionReportStatus;
  completedAt: string;
  durationMs: number;
  /** Evidence engine outputs */
  sourcesScanned: string[];
  communitiesAnalyzed: number;
  signalsFound: number;
  criticalCount: number;
  confidence: number;
  /** Structured brief payload */
  headline: string;
  summary: string;
  priority?: IntelligenceBrief["priority"];
  impact?: IntelligenceBrief["impact"];
  funding?: IntelligenceBrief["funding"];
  simulations?: IntelligenceBrief["simulations"];
  recommendations: IntelligenceBrief["recommendations"];
  options: IntelligenceBrief["options"];
  evidenceLinks: MissionReportEvidenceLink[];
  actions: CapabilityAction[];
  findings: MissionFinding[];
  /** Settlement receipt fields when execute completes */
  settlement?: {
    batchId?: string;
    recipientCount?: number;
    amountUsd?: number;
    network?: string;
    txHash?: string;
    explorerUrl?: string;
  };
  persisted: boolean;
};

function reportIdFrom(seed: string) {
  const hex = Buffer.from(seed).toString("hex").slice(0, 16);
  return `mrep_${hex}`;
}

function evidenceLinksFromContext(ctx: OrchestratorContext): MissionReportEvidenceLink[] {
  const links: MissionReportEvidenceLink[] = [];

  for (const sensor of ctx.community.sensors.slice(0, 4)) {
    links.push({
      label: sensor.evidenceLabel,
      source: LAYER_LABELS[sensor.layer],
    });
  }

  for (const o of ctx.opportunities.slice(0, 3)) {
    links.push({
      label: o.fullName,
      href: `https://github.com/${o.fullName}`,
      source: "Observation",
    });
  }

  for (const t of ctx.traces) {
    if (t.status !== "ok") continue;
    const label = t.layer ? `${LAYER_LABELS[t.layer]} evidence` : t.summary.slice(0, 48);
    if (!links.some((l) => l.label === label)) {
      links.push({ label, source: t.layer ? LAYER_LABELS[t.layer] : "Evidence" });
    }
  }
  return links.slice(0, 8);
}

/** Evidence artifact produced by every mission capability run — not chat prose. */
export function buildMissionReport(input: {
  ctx: OrchestratorContext;
  brief: IntelligenceBrief;
  actions: CapabilityAction[];
  objective: string;
  missionId?: string;
  turnId?: string;
  durationMs: number;
  persisted?: boolean;
  settlement?: MissionReport["settlement"];
}): MissionReport {
  const { ctx, brief, actions, objective, missionId, turnId, durationMs, persisted, settlement } =
    input;

  const communitiesAnalyzed =
    ctx.opportunities.length ||
    ctx.concentrations.length ||
    brief.findingCount ||
    0;

  const criticalCount = ctx.findings.filter(
    (f) => f.severity === "critical" || f.id === "funding-gap",
  ).length;

  const confidence =
    brief.priority?.confidence ??
    (ctx.findings[0]?.confidence ?? 0.85);

  const status: MissionReportStatus =
    settlement?.txHash ? "complete"
    : ctx.capability === "execute_settlement" && ctx.phase === "execute" ? "pending_approval"
    : "complete";

  const seed = `${missionId ?? "local"}:${turnId ?? objective}:${Date.now()}`;

  return {
    reportId: reportIdFrom(seed),
    missionId,
    turnId,
    capability: brief.capability,
    capabilityLabel: brief.capabilityLabel,
    objective,
    status,
    completedAt: new Date().toISOString(),
    durationMs,
    sourcesScanned: brief.evidence,
    communitiesAnalyzed,
    signalsFound: brief.findingCount,
    criticalCount,
    confidence,
    headline: brief.headline,
    summary: brief.summary,
    priority: brief.priority,
    impact: brief.impact,
    funding: brief.funding,
    simulations: brief.simulations,
    recommendations: brief.recommendations,
    options: brief.options,
    evidenceLinks: evidenceLinksFromContext(ctx),
    actions,
    findings: brief.findings,
    settlement,
    persisted: persisted ?? false,
  };
}

export function missionReportToJson(report: MissionReport): string {
  return JSON.stringify(report, null, 2);
}

/** Legacy turns that only stored IntelligenceBrief */
export function reportFromBrief(
  brief: IntelligenceBrief,
  objective: string,
  actions: CapabilityAction[] = [],
): MissionReport {
  return {
    reportId: `mrep_legacy_${Date.now()}`,
    capability: brief.capability,
    capabilityLabel: brief.capabilityLabel,
    objective,
    status: "complete",
    completedAt: new Date().toISOString(),
    durationMs: 0,
    sourcesScanned: brief.evidence,
    communitiesAnalyzed: brief.findingCount,
    signalsFound: brief.findingCount,
    criticalCount: 0,
    confidence: brief.priority?.confidence ?? 0.85,
    headline: brief.headline,
    summary: brief.summary,
    priority: brief.priority,
    impact: brief.impact,
    funding: brief.funding,
    simulations: brief.simulations,
    recommendations: brief.recommendations,
    options: brief.options,
    evidenceLinks: [],
    actions,
    findings: brief.findings,
    persisted: false,
  };
}
