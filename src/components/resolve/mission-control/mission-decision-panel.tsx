"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  Check,
  CircleDollarSign,
  FileCheck2,
  FileStack,
  FlaskConical,
  PanelRightClose,
  PanelRightOpen,
  ShieldCheck,
  Target,
} from "lucide-react";
import clsx from "clsx";
import type { MissionTurn } from "@/components/resolve/mission-control/mission-workspace";
import type { CapabilityAction } from "@/lib/mission/capabilities/types";
import type { CapitalLoopPhase } from "@/lib/mission/capital-os";
import type { ServerTimelineEvent } from "@/lib/mission/client-api";
import { MissionTimeline } from "@/components/resolve/mission-control/mission-timeline";

const TABS = [
  { id: "objective", label: "Objective", icon: Target },
  { id: "evidence", label: "Evidence", icon: FileCheck2 },
  { id: "blueprint", label: "Blueprint", icon: FileStack },
  { id: "simulation", label: "Simulation", icon: FlaskConical },
  { id: "authorize", label: "Authorize", icon: ShieldCheck },
] as const;

type DecisionTab = (typeof TABS)[number]["id"];

function formatUsd(value?: number) {
  if (value === undefined) return "—";
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function MissionDecisionPanel({
  collapsed,
  onToggle,
  objective,
  lastResolve,
  hasBlueprint,
  simulated,
  authorizing,
  loopPhase,
  timeline,
  timelineLoading,
  treasuryBalanceUsd,
  onAction,
  loading,
}: {
  collapsed: boolean;
  onToggle: () => void;
  objective: string | null;
  lastResolve?: MissionTurn;
  hasBlueprint: boolean;
  simulated: boolean;
  authorizing: boolean;
  loopPhase: CapitalLoopPhase;
  timeline: ServerTimelineEvent[];
  timelineLoading?: boolean;
  treasuryBalanceUsd?: number;
  onAction: (action: CapabilityAction) => void;
  loading?: boolean;
}) {
  const report = lastResolve?.report;
  const blueprint = report?.capitalBlueprint;
  const findings = lastResolve?.findings ?? report?.findings ?? [];
  const evidenceLinks = report?.evidenceLinks ?? [];
  const sourceLabels = Array.from(
    new Set([...(report?.sourcesScanned ?? []), ...evidenceLinks.map((item) => item.source)]),
  );
  const hasEvidence = sourceLabels.length > 0 || findings.length > 0;
  const authorized = Boolean(report?.settlement?.txHash || loopPhase === "measure");
  const meaningful = Boolean(objective || lastResolve || hasBlueprint || simulated || authorizing);
  const [activeTab, setActiveTab] = useState<DecisionTab>("objective");

  useEffect(() => {
    if (authorized || authorizing) setActiveTab("authorize");
    else if (simulated) setActiveTab("simulation");
    else if (hasBlueprint) setActiveTab("blueprint");
    else if (hasEvidence) setActiveTab("evidence");
    else setActiveTab("objective");
  }, [authorized, authorizing, hasBlueprint, hasEvidence, simulated]);

  const relevantActions = (report?.actions ?? lastResolve?.nextSteps ?? []).filter((action) => {
    if (activeTab === "blueprint") return action.kind === "simulate" || action.kind === "plan";
    if (activeTab === "simulation") return action.kind === "simulate" || action.kind === "execute";
    if (activeTab === "authorize") return action.kind === "execute";
    if (activeTab === "evidence") return action.kind === "explore";
    return action.kind === "plan" || action.kind === "explore";
  });

  if (collapsed) {
    return (
      <aside className="mission-decision-panel mission-decision-panel--collapsed">
        <button type="button" onClick={onToggle} className="mission-panel-toggle" aria-label="Open decision workspace">
          <PanelRightOpen className="h-4 w-4" />
          {meaningful && <span className="mission-panel-toggle__signal" aria-hidden />}
        </button>
      </aside>
    );
  }

  return (
    <aside className="mission-decision-panel" aria-label="Mission decision workspace">
      <div className="mission-decision-panel__header">
        <div>
          <p className="mission-kicker">Decision workspace</p>
          <h2>{objective ? "Active decision" : "No artifact yet"}</h2>
        </div>
        <button type="button" onClick={onToggle} className="mission-panel-toggle" aria-label="Collapse decision workspace">
          <PanelRightClose className="h-4 w-4" />
        </button>
      </div>

      {!meaningful ? (
        <div className="mission-decision-empty">
          <Target className="h-4 w-4" aria-hidden />
          <div>
            <strong>No decision artifact yet</strong>
            <span>Run a signal or ask Mission to begin.</span>
          </div>
        </div>
      ) : (
        <>
          <div className="mission-decision-tabs" role="tablist" aria-label="Decision artifacts">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  title={tab.label}
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(activeTab === tab.id && "is-active")}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="mission-decision-panel__scroll">
            {activeTab === "objective" && (
              <section className="mission-decision-artifact mission-decision-artifact--objective">
                <div className="mission-decision-artifact__label"><Target className="h-3.5 w-3.5" /> Objective</div>
                <h3>{objective}</h3>
                <dl className="mission-decision-metrics">
                  <div><dt>Scope</dt><dd>{report?.capitalBlueprint?.community ?? "Current Mission"}</dd></div>
                  <div><dt>Mode</dt><dd>{report?.operatingMode ?? "Decision support"}</dd></div>
                  <div><dt>Status</dt><dd>{lastResolve ? "Analyzed" : "Understanding"}</dd></div>
                </dl>
              </section>
            )}

            {activeTab === "evidence" && (
              <section className="mission-decision-artifact mission-decision-artifact--evidence">
                <div className="mission-decision-artifact__label"><FileCheck2 className="h-3.5 w-3.5" /> Evidence</div>
                <div className="mission-evidence-summary">
                  <strong>{sourceLabels.length || findings.length}</strong>
                  <span>{sourceLabels.length === 1 ? "source checked" : "sources checked"}</span>
                  {report && <b>{Math.round(report.confidence * 100)}% confidence</b>}
                </div>
                {hasEvidence ? (
                  <ul className="mission-evidence-list">
                    {(evidenceLinks.length ? evidenceLinks : sourceLabels.map((source) => ({ source, label: "Evidence recorded" })))
                      .slice(0, 6)
                      .map((item, index) => (
                        <li key={`${item.source}-${item.label}-${index}`}>
                          <span className="mission-source-badge">{item.source}</span>
                          <span>{item.label}</span>
                          <small>Recorded</small>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className="mission-artifact-placeholder">Evidence will appear after Mission completes its first analysis.</p>
                )}
              </section>
            )}

            {activeTab === "blueprint" && (
              <section className="mission-decision-artifact mission-decision-artifact--blueprint">
                <div className="mission-decision-artifact__label"><FileStack className="h-3.5 w-3.5" /> Funding Blueprint</div>
                {blueprint ? (
                  <>
                    <h3>{blueprint.title}</h3>
                    <dl className="mission-decision-metrics mission-decision-metrics--grid">
                      <div><dt>Budget</dt><dd>{formatUsd(blueprint.totalCapitalUsd)}</dd></div>
                      <div><dt>Payees</dt><dd>{blueprint.recipients.length}</dd></div>
                      <div><dt>Policy</dt><dd>{blueprint.flows[0]?.mechanism ?? "Evidence weighted"}</dd></div>
                      <div><dt>Confidence</dt><dd>{Math.round(blueprint.confidence * 100)}%</dd></div>
                    </dl>
                    <div className="mission-blueprint-mini-ledger">
                      {blueprint.distribution.slice(0, 4).map((line) => (
                        <div key={line.category}>
                          <span>{line.category}</span><i style={{ width: `${Math.min(100, line.percent)}%` }} /><strong>{line.percent}%</strong>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="mission-artifact-placeholder">A structured budget, payee ledger, and policy will appear here.</p>
                )}
              </section>
            )}

            {activeTab === "simulation" && (
              <section className="mission-decision-artifact mission-decision-artifact--simulation">
                <div className="mission-decision-artifact__label"><BarChart3 className="h-3.5 w-3.5" /> Simulation</div>
                {report?.simulations?.length ? (
                  <dl className="mission-simulation-list">
                    {report.simulations.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
                  </dl>
                ) : (
                  <p className="mission-artifact-placeholder">Simulate the Blueprint to preview recipients, amounts, and funding readiness.</p>
                )}
                <p className={clsx("mission-artifact-state", simulated && "is-complete")}>
                  {simulated ? <><Check className="h-3.5 w-3.5" /> Simulation complete</> : <><FlaskConical className="h-3.5 w-3.5" /> Awaiting simulation</>}
                </p>
              </section>
            )}

            {activeTab === "authorize" && (
              <section className="mission-decision-artifact mission-decision-artifact--authorize">
                <div className="mission-decision-artifact__label"><ShieldCheck className="h-3.5 w-3.5" /> Authorization</div>
                <dl className="mission-decision-metrics mission-decision-metrics--grid">
                  <div><dt>Treasury</dt><dd>{formatUsd(treasuryBalanceUsd)}</dd></div>
                  <div><dt>Network</dt><dd>{report?.settlement?.network ?? "Arc"}</dd></div>
                  <div><dt>Recipients</dt><dd>{report?.settlement?.recipientCount ?? blueprint?.recipients.length ?? "—"}</dd></div>
                  <div><dt>Status</dt><dd>{authorized ? "Settled" : authorizing ? "Pending" : "Review"}</dd></div>
                </dl>
                {report?.settlement?.txHash && (
                  <div className="mission-receipt-summary">
                    <p>{formatUsd(report.settlement.amountUsd)} USDC</p>
                    <small>Settlement confirmed</small>
                    {report.settlement.explorerUrl && <a href={report.settlement.explorerUrl} target="_blank" rel="noreferrer">View receipt</a>}
                  </div>
                )}
                {(timeline.length > 0 || timelineLoading) && (
                  <div className="mission-decision-timeline">
                    <p><Activity className="h-3.5 w-3.5" /> Execution timeline</p>
                    <MissionTimeline events={timeline} loading={timelineLoading} />
                  </div>
                )}
              </section>
            )}

            {relevantActions.length > 0 && (
              <div className="mission-decision-actions">
                {relevantActions.slice(0, 2).map((action, index) => (
                  <button
                    key={action.id}
                    type="button"
                    disabled={loading}
                    onClick={() => onAction(action)}
                    className={clsx("mission-btn", index === 0 ? "mission-btn--primary" : "mission-btn--ghost")}
                  >
                    {activeTab === "blueprint" && index === 0 ? <FlaskConical className="h-4 w-4" /> : <CircleDollarSign className="h-4 w-4" />}
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
