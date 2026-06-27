"use client";

import { useEffect, useRef, type FormEvent } from "react";
import { Loader2, Send } from "lucide-react";
import { MissionThinking } from "@/components/resolve/mission-control/mission-thinking";
import { MissionSidebar } from "@/components/resolve/mission-control/mission-sidebar";
import { MissionReportCard } from "@/components/resolve/mission-control/mission-report-card";
import { MissionContextPanel } from "@/components/resolve/mission-control/mission-context-panel";
import { MissionLiveDelta } from "@/components/resolve/mission-control/mission-live-delta";
import { MissionStarterPanel } from "@/components/resolve/mission-control/mission-quick-actions";
import { MissionResearchRefs } from "@/components/resolve/mission-control/mission-research-refs";
import { MissionBrief } from "@/components/resolve/mission-control/mission-brief";
import type { MissionFinding } from "@/lib/workspace/advisors/intelligence-findings";
import type { MissionPhase } from "@/lib/mission/phases";
import type { CapabilityAction, CapabilityId } from "@/lib/mission/capabilities/types";
import type { AllocationLine } from "@/components/resolve/mission-control/mission-recommendation";
import type { Ecosystem } from "@/lib/mission/ecosystems";
import type { PolicyProposal } from "@/lib/workspace/advisors/policy-proposals";
import type { IntelligenceBrief } from "@/lib/mission/intelligence-brief";
import type { MissionReport } from "@/lib/mission/mission-report";
import { reportFromBrief } from "@/lib/mission/mission-report";
import type { ServerTimelineEvent } from "@/lib/mission/client-api";
import { statusLabel } from "@/lib/mission/state-machine";
import type { MissionStatus } from "@/lib/mission/state-machine";
import type { AutomationRule } from "@/lib/mission/toolbox/types";
import type { MissionBriefData } from "@/components/resolve/mission-control/mission-brief";

export type MissionTurn = {
  id: string;
  role: "user" | "resolve";
  text: string;
  brief?: IntelligenceBrief;
  report?: MissionReport;
  findings?: MissionFinding[];
  phase?: MissionPhase;
  capability?: CapabilityId;
  allocations?: AllocationLine[];
  policy?: PolicyProposal;
  nextSteps?: CapabilityAction[];
  researchReferences?: import("@/lib/mission/capabilities/types").ResearchReference[];
};

export function MissionWorkspace({
  objective,
  turns,
  loading,
  thinkingComplete,
  phase,
  input,
  onInputChange,
  onSubmit,
  onAction,
  onNewMission,
  onSelectSession,
  onSelectWorkspace,
  onObservatoryPulse,
  onAutomationSelect,
  activeSessionId,
  activeWorkspace,
  missionStatus,
  thinkingSteps,
  libraryTick,
  liveDelta,
  policies,
  selectedPolicyId,
  onSelectPolicy,
  showCapital,
  showPolicies,
  showTimeline,
  timeline,
  timelineLoading,
  treasuryBalanceUsd,
  missionBrief,
}: {
  objective: string | null;
  turns: MissionTurn[];
  loading: boolean;
  thinkingComplete: boolean;
  phase: MissionPhase;
  input: string;
  onInputChange: (v: string) => void;
  onSubmit: (text: string) => void;
  onAction: (action: CapabilityAction) => void;
  onNewMission: () => void;
  onSelectSession: (session: import("@/lib/mission/toolbox/mission-library").MissionSession) => void;
  onSelectWorkspace: (workspace: Ecosystem | null) => void;
  onObservatoryPulse: (query: string) => void;
  onAutomationSelect: (rule: AutomationRule) => void;
  activeSessionId?: string | null;
  activeWorkspace?: Ecosystem | null;
  missionStatus?: string | null;
  thinkingSteps?: readonly string[];
  libraryTick?: number;
  liveDelta?: ServerTimelineEvent[];
  policies: PolicyProposal[];
  selectedPolicyId: string | null;
  onSelectPolicy: (id: string) => void;
  showCapital: boolean;
  showPolicies: boolean;
  showTimeline: boolean;
  timeline: ServerTimelineEvent[];
  timelineLoading?: boolean;
  treasuryBalanceUsd?: number;
  missionBrief: MissionBriefData | null;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const active = Boolean(objective || turns.length > 0);
  const lastResolve = [...turns].reverse().find((t) => t.role === "resolve");
  const lastAllocations = lastResolve?.allocations;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, loading, thinkingComplete]);

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    onSubmit(input.trim());
  }

  const placeholder =
    activeWorkspace ?
      `Direct RESOLVE inside ${activeWorkspace.name}…`
    : objective ?
      "Refine objective or run a capability…"
    : "State a mission objective…";

  return (
    <div className="flex h-[calc(100vh-3.75rem)] min-h-[560px]">
      <MissionSidebar
        onNewMission={onNewMission}
        onSelectSession={onSelectSession}
        onSelectWorkspace={onSelectWorkspace}
        onObservatoryPulse={onObservatoryPulse}
        onAutomationSelect={onAutomationSelect}
        activeSessionId={activeSessionId}
        activeWorkspaceId={activeWorkspace?.id ?? null}
        libraryVersion={libraryTick}
      />

      <MissionBrief brief={missionBrief} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="shrink-0 border-b border-white/[0.06] px-4 py-3 lg:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              {activeWorkspace ?
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-resolve-accent">
                  Community · {activeWorkspace.name}
                </p>
              : <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-resolve-muted-dim">
                  Operating system for funding open communities
                </p>}
              <h1 className="mt-0.5 text-base font-semibold text-white">
                {objective ?? "New mission"}
              </h1>
            </div>
            {missionStatus && (
              <span className="rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] text-resolve-muted">
                {statusLabel(missionStatus as MissionStatus)}
              </span>
            )}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 lg:px-6">
          <div className="mx-auto max-w-3xl space-y-5">
            {!active && (
              <MissionStarterPanel onSelect={onSubmit} disabled={loading} />
            )}

            {liveDelta && liveDelta.length > 0 && <MissionLiveDelta events={liveDelta} />}

            {turns.map((turn) =>
              turn.role === "user" ?
                <p key={turn.id} className="text-[11px] font-medium uppercase tracking-wide text-resolve-muted-dim">
                  Intent · {turn.text}
                </p>
              : <div key={turn.id} className="space-y-3">
                  {turn.report ?
                    <>
                      <MissionReportCard
                        report={turn.report}
                        onAction={turn === lastResolve ? onAction : undefined}
                        actionsDisabled={loading}
                      />
                      {turn.researchReferences && turn.researchReferences.length > 0 && (
                        <MissionResearchRefs references={turn.researchReferences} />
                      )}
                    </>
                  : turn.brief ?
                    <MissionReportCard
                      report={reportFromBrief(
                        turn.brief,
                        objective ?? turn.text,
                        turn.nextSteps ?? [],
                      )}
                      onAction={turn === lastResolve ? onAction : undefined}
                      actionsDisabled={loading}
                    />
                  : <p className="text-sm text-resolve-muted">{turn.text}</p>}
                </div>,
            )}

            {loading && (
              <MissionThinking
                active={loading}
                complete={thinkingComplete}
                steps={thinkingSteps}
              />
            )}
            <div ref={endRef} />
          </div>
        </div>

        <div className="shrink-0 border-t border-white/[0.06] px-4 py-3 lg:px-6">
          <form onSubmit={handleFormSubmit} className="mx-auto max-w-3xl">
            <div className="relative">
              <input
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
                placeholder={placeholder}
                disabled={loading}
                className="w-full rounded-full border border-white/[0.1] bg-[#0a0f18]/90 px-5 py-3 pr-12 text-sm text-white placeholder:text-resolve-muted-dim focus:border-resolve-accent/40 focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white text-black transition hover:bg-white/90 disabled:opacity-30"
                aria-label="Run capability"
              >
                {loading ?
                  <Loader2 className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />}
              </button>
            </div>
          </form>
          <p className="mx-auto mt-1.5 max-w-3xl text-center text-[10px] text-resolve-muted-dim">
            Communities confusing you? Observe → Understand → Capital → Settlement
          </p>
        </div>
      </div>

      <MissionContextPanel
        phase={phase}
        showCapital={showCapital}
        showPolicies={showPolicies}
        showTimeline={showTimeline}
        policies={policies}
        selectedPolicyId={selectedPolicyId}
        onSelectPolicy={onSelectPolicy}
        allocations={lastAllocations}
        treasuryBalanceUsd={treasuryBalanceUsd}
        timeline={timeline}
        timelineLoading={timelineLoading}
      />
    </div>
  );
}
