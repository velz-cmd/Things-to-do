"use client";

import { useState } from "react";
import {
  Activity,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  FileCheck2,
  FlaskConical,
  PanelRightClose,
  PanelRightOpen,
  ShieldCheck,
} from "lucide-react";
import clsx from "clsx";
import type { MissionTurn } from "@/components/resolve/mission-control/mission-workspace";
import type { CapabilityAction } from "@/lib/mission/capabilities/types";
import type { CapitalLoopPhase } from "@/lib/mission/capital-os";
import type { ServerTimelineEvent } from "@/lib/mission/client-api";
import { MissionTimeline } from "@/components/resolve/mission-control/mission-timeline";

function statusLabel(active: boolean, complete: boolean) {
  if (complete) return "Complete";
  return active ? "In review" : "Waiting";
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
  const [assemblyOpen, setAssemblyOpen] = useState(false);
  const report = lastResolve?.report;
  const evidence = report?.evidenceLinks ?? [];
  const findings = lastResolve?.findings ?? report?.findings ?? [];
  const decisions = lastResolve?.nextSteps ?? report?.actions ?? [];
  const authorized = Boolean(report?.settlement?.txHash || loopPhase === "measure");
  const settlement = report?.settlement;

  if (collapsed) {
    return (
      <aside className="mission-decision-panel mission-decision-panel--collapsed">
        <button type="button" onClick={onToggle} className="mission-panel-toggle" aria-label="Open decision panel">
          <PanelRightOpen className="h-4 w-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="mission-decision-panel" aria-label="Mission decision panel">
      <div className="mission-decision-panel__header">
        <div>
          <p className="mission-kicker">Decision workspace</p>
          <h2>Capital decision</h2>
        </div>
        <button type="button" onClick={onToggle} className="mission-panel-toggle" aria-label="Collapse decision panel">
          <PanelRightClose className="h-4 w-4" />
        </button>
      </div>

      <div className="mission-decision-panel__scroll">
        {!objective ? (
          <div className="mission-decision-empty">
            <ShieldCheck className="h-5 w-5 text-violet-300" aria-hidden />
            <p className="mt-3 text-sm font-medium text-white">Nothing executes without approval.</p>
            <p className="mt-1 text-xs leading-relaxed text-resolve-muted">
              Objective, evidence, payees, policy, simulation, and authorization will assemble here as the mission progresses.
            </p>
          </div>
        ) : (
          <>
            <ol className="mission-decision-stages">
              <li className="is-complete">
                <span><Check className="h-3 w-3" /></span>
                <div><strong>Objective</strong><small>Locked</small></div>
              </li>
              <li className={clsx((evidence.length || findings.length) && "is-complete", !lastResolve && "is-active")}>
                <span><FileCheck2 className="h-3 w-3" /></span>
                <div><strong>Evidence</strong><small>{statusLabel(!lastResolve, Boolean(evidence.length || findings.length))}</small></div>
              </li>
              <li className={clsx(hasBlueprint && "is-complete", lastResolve && !hasBlueprint && "is-active")}>
                <span><CircleDollarSign className="h-3 w-3" /></span>
                <div><strong>Blueprint</strong><small>{statusLabel(Boolean(lastResolve && !hasBlueprint), hasBlueprint)}</small></div>
              </li>
              <li className={clsx(simulated && "is-complete", hasBlueprint && !simulated && "is-active")}>
                <span><FlaskConical className="h-3 w-3" /></span>
                <div><strong>Simulation</strong><small>{statusLabel(hasBlueprint && !simulated, simulated)}</small></div>
              </li>
              <li className={clsx(authorized && "is-complete", (simulated || authorizing) && !authorized && "is-active")}>
                <span><ShieldCheck className="h-3 w-3" /></span>
                <div><strong>Authorization</strong><small>{authorizing ? "Pending" : statusLabel(simulated, authorized)}</small></div>
              </li>
            </ol>

            {(evidence.length > 0 || findings.length > 0) && (
              <section className="mission-decision-section">
                <div className="mission-decision-section__heading">
                  <span>Evidence packet</span>
                  <span>{evidence.length || findings.length} source{(evidence.length || findings.length) === 1 ? "" : "s"}</span>
                </div>
                <ul className="mission-evidence-list">
                  {evidence.slice(0, 4).map((item) => (
                    <li key={`${item.source}-${item.label}`}>
                      <span className="mission-source-badge">{item.source}</span>
                      <span>{item.label}</span>
                    </li>
                  ))}
                  {evidence.length === 0 && findings.slice(0, 4).map((item) => (
                    <li key={item.id}>
                      <span className="mission-source-badge">Analysis</span>
                      <span>{item.title}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {decisions.length > 0 && (
              <section className="mission-decision-section">
                <div className="mission-decision-section__heading"><span>Recommended decisions</span></div>
                <div className="mission-recommendation-stack">
                  {decisions.slice(0, 3).map((action, index) => (
                    <button
                      key={action.id}
                      type="button"
                      disabled={loading}
                      onClick={() => onAction(action)}
                      className={clsx("mission-recommendation-row", index === 0 && "is-primary")}
                    >
                      <span>{action.label}</span><ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  ))}
                </div>
              </section>
            )}

            {(lastResolve || treasuryBalanceUsd !== undefined) && (
              <section className="mission-decision-section">
                <button type="button" onClick={() => setAssemblyOpen((value) => !value)} className="mission-assembly-toggle">
                  <span><Activity className="h-3.5 w-3.5 text-cyan-300" />Capital assembly line</span>
                  <ChevronDown className={clsx("h-3.5 w-3.5 transition", assemblyOpen && "rotate-180")} />
                </button>
                {assemblyOpen && (
                  <div className="mission-assembly-line">
                    <span>Signal</span><i /><span>Policy</span><i /><span>Arc</span>
                    {treasuryBalanceUsd !== undefined && <p>Treasury ${treasuryBalanceUsd.toLocaleString()}</p>}
                  </div>
                )}
              </section>
            )}

            {settlement?.txHash && (
              <section className="mission-decision-section mission-receipt-summary">
                <div className="mission-decision-section__heading"><span>Receipt</span><span>Confirmed</span></div>
                {settlement.amountUsd !== undefined && <p>${settlement.amountUsd.toLocaleString()} USDC</p>}
                <small>{settlement.network ?? "Settlement network"} · {settlement.recipientCount ?? 0} recipients</small>
                {settlement.explorerUrl && <a href={settlement.explorerUrl} target="_blank" rel="noreferrer">Open explorer</a>}
              </section>
            )}

            {(timeline.length > 0 || timelineLoading) && (
              <section className="mission-decision-section">
                <div className="mission-decision-section__heading"><span>Execution timeline</span></div>
                <MissionTimeline events={timeline} loading={timelineLoading} />
              </section>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
