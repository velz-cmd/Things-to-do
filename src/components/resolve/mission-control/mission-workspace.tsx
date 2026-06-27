"use client";

import { useEffect, useRef, type FormEvent } from "react";
import { Loader2, Send } from "lucide-react";
import { MissionThinking } from "@/components/resolve/mission-control/mission-thinking";
import { MissionSidebar } from "@/components/resolve/mission-control/mission-sidebar";
import { IntelligenceBriefCard } from "@/components/resolve/mission-control/intelligence-brief-card";
import { MissionCapabilityActions } from "@/components/resolve/mission-control/mission-capability-actions";
import { MissionContextPanel } from "@/components/resolve/mission-control/mission-context-panel";
import { MissionLiveDelta } from "@/components/resolve/mission-control/mission-live-delta";
import { MissionBrief } from "@/components/resolve/mission-control/mission-brief";
import type { MissionFinding } from "@/lib/workspace/advisors/intelligence-findings";
import type { MissionPhase } from "@/lib/mission/phases";
import type { CapabilityAction, CapabilityId } from "@/lib/mission/capabilities/types";
import type { AllocationLine } from "@/components/resolve/mission-control/mission-recommendation";
import type { Ecosystem } from "@/lib/mission/ecosystems";
import type { PolicyProposal } from "@/lib/workspace/advisors/policy-proposals";
import type { IntelligenceBrief } from "@/lib/mission/intelligence-brief";
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
  findings?: MissionFinding[];
  phase?: MissionPhase;
  capability?: CapabilityId;
  allocations?: AllocationLine[];
  policy?: PolicyProposal;
  nextSteps?: CapabilityAction[];
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
                  Workspace · {activeWorkspace.name}
                </p>
              : <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-resolve-muted-dim">
                  Economic operating system
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
              <div className="rounded-xl border border-dashed border-white/[0.08] p-8 text-center">
                <p className="text-sm text-resolve-muted">
                  {activeWorkspace ?
                    `You are inside ${activeWorkspace.name}. State one economic objective — fund, discover, compare, or assess.`
                  : "Select a workspace or start a mission. Conversation is one tool inside the workspace — not the product."}
                </p>
              </div>
            )}

            {liveDelta && liveDelta.length > 0 && <MissionLiveDelta events={liveDelta} />}

            {turns.map((turn) =>
              turn.role === "user" ?
                <p key={turn.id} className="text-[11px] font-medium uppercase tracking-wide text-resolve-muted-dim">
                  Intent · {turn.text}
                </p>
              : <div key={turn.id} className="space-y-3">
                  {turn.brief ?
                    <IntelligenceBriefCard brief={turn.brief} objective={objective ?? undefined} />
                  : <p className="text-sm text-resolve-muted">{turn.text}</p>}
                  {turn === lastResolve &&
                    turn.nextSteps &&
                    turn.nextSteps.length > 0 &&
                    !loading && (
                      <MissionCapabilityActions
                        actions={turn.nextSteps}
                        onAction={onAction}
                        disabled={loading}
                      />
                    )}
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
          <form onSubmit={handleFormSubmit} className="mx-auto flex max-w-3xl gap-2">
            <div className="relative min-w-0 flex-1">
              <input
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
                placeholder={placeholder}
                disabled={loading}
                className="w-full rounded-lg border border-white/[0.08] bg-[#0a0f18]/80 px-4 py-2.5 text-sm text-white placeholder:text-resolve-muted-dim focus:border-resolve-accent/40 focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-resolve-muted transition hover:text-white disabled:opacity-30"
                aria-label="Run capability"
              >
                {loading ?
                  <Loader2 className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />}
              </button>
            </div>
          </form>
          <p className="mx-auto mt-1.5 max-w-3xl text-center text-[10px] text-resolve-muted-dim">
            Observe → Understand → Reason → Decide → Execute → Learn
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
