"use client";

import { useEffect, useRef, type FormEvent } from "react";
import { Loader2, Send } from "lucide-react";
import { MissionThinking } from "@/components/resolve/mission-control/mission-thinking";
import { MissionEmptyState } from "@/components/resolve/mission-control/mission-empty-state";
import { MissionHistorySidebar } from "@/components/resolve/mission-control/mission-history-sidebar";
import { MissionReportCard } from "@/components/resolve/mission-control/mission-report-card";
import { MissionContextPanel } from "@/components/resolve/mission-control/mission-context-panel";
import { MissionWorldSnapshot } from "@/components/resolve/mission-control/mission-world-snapshot";
import { MissionQuickActions } from "@/components/resolve/mission-control/mission-quick-actions";
import {
  MissionPlanningBar,
  MissionExecuteBar,
} from "@/components/resolve/mission-control/mission-planning-bar";
import { shouldShowExecuteBar, shouldShowPlanningBar } from "@/lib/mission/phases";
import type { OperatingMode, CapitalLoopPhase } from "@/lib/mission/capital-os";
import type { MissionFinding } from "@/lib/workspace/advisors/intelligence-findings";
import type { MissionPhase } from "@/lib/mission/phases";
import type { CapabilityAction, CapabilityId } from "@/lib/mission/capabilities/types";
import type { AllocationLine } from "@/components/resolve/mission-control/mission-recommendation";
import type { PolicyProposal } from "@/lib/workspace/advisors/policy-proposals";
import type { IntelligenceBrief } from "@/lib/mission/intelligence-brief";
import type { MissionReport } from "@/lib/mission/mission-report";
import { reportFromBrief } from "@/lib/mission/mission-report";
import type { ServerTimelineEvent } from "@/lib/mission/client-api";
import type { MissionTopic } from "@/lib/mission/mission-topic";

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
  activeSessionId,
  missionStatus,
  thinkingSteps,
  libraryTick,
  policies,
  selectedPolicyId,
  onSelectPolicy,
  showCapital,
  showPolicies,
  showTimeline,
  timeline,
  timelineLoading,
  treasuryBalanceUsd,
  topic,
  operatingMode,
  loopPhase,
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
  activeSessionId?: string | null;
  missionStatus?: string | null;
  thinkingSteps?: readonly string[];
  libraryTick?: number;
  policies: PolicyProposal[];
  selectedPolicyId: string | null;
  onSelectPolicy: (id: string) => void;
  showCapital: boolean;
  showPolicies: boolean;
  showTimeline: boolean;
  timeline: ServerTimelineEvent[];
  timelineLoading?: boolean;
  treasuryBalanceUsd?: number;
  topic: MissionTopic | null;
  operatingMode: OperatingMode;
  loopPhase: CapitalLoopPhase;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const started = Boolean(objective || turns.length > 0 || loading);
  const lastResolve = [...turns].reverse().find((t) => t.role === "resolve");
  const lastAllocations = lastResolve?.allocations;
  const followUpActions = lastResolve?.nextSteps ?? lastResolve?.report?.actions ?? [];
  const showPlanning = shouldShowPlanningBar(phase);
  const showExecute = shouldShowExecuteBar(phase);
  const lastReport = lastResolve?.report;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, loading, thinkingComplete]);

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    onSubmit(input.trim());
  }

  if (!started) {
    return (
      <MissionEmptyState
        input={input}
        onInputChange={onInputChange}
        onSubmit={onSubmit}
        loading={loading}
      />
    );
  }

  const displayTopic = topic ?? (objective ? { name: objective.slice(0, 48), kind: "general" as const } : null);

  return (
    <div className="flex h-[calc(100vh-3.75rem)] min-h-[560px]">
      <MissionHistorySidebar
        onNewMission={onNewMission}
        onSelectSession={onSelectSession}
        activeSessionId={activeSessionId}
        libraryVersion={libraryTick}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {displayTopic && displayTopic.kind !== "general" && (
          <MissionWorldSnapshot topic={displayTopic.name} kind={displayTopic.kind} report={lastReport} />
        )}
        {displayTopic && displayTopic.kind === "general" && !loading && (
          <div className="border-b border-white/[0.06] px-4 py-3 lg:px-6">
            <h2 className="text-base font-semibold text-white">{displayTopic.name}</h2>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 lg:px-6">
          <div className="mx-auto max-w-2xl space-y-4">
            {turns.map((turn) =>
              turn.role === "user" ?
                <p key={turn.id} className="text-sm text-white/90">
                  {turn.text}
                </p>
              : <div key={turn.id}>
                  {turn.report ?
                    <MissionReportCard
                      report={turn.report}
                      topicName={topic?.name}
                      onAction={turn === lastResolve ? onAction : undefined}
                      onChip={turn === lastResolve ? (t) => onSubmit(t) : undefined}
                      actionsDisabled={loading}
                    />
                  : turn.brief ?
                    <MissionReportCard
                      report={reportFromBrief(
                        turn.brief,
                        objective ?? turn.text,
                        turn.nextSteps ?? [],
                      )}
                      topicName={topic?.name}
                      onAction={turn === lastResolve ? onAction : undefined}
                      onChip={turn === lastResolve ? (t) => onSubmit(t) : undefined}
                      actionsDisabled={loading}
                    />
                  : <p className="text-sm text-resolve-muted">{turn.text}</p>}
                </div>,
            )}

            {loading && (
              <MissionThinking active={loading} complete={thinkingComplete} steps={thinkingSteps} />
            )}
            <div ref={endRef} />
          </div>
        </div>

        <div className="shrink-0 border-t border-white/[0.06] px-4 py-3 lg:px-6">
          {followUpActions.length > 0 && !loading && !showPlanning && !showExecute && (
            <div className="mx-auto mb-3 max-w-2xl">
              <MissionQuickActions
                actions={followUpActions.slice(0, 5).map((a) => ({
                  id: a.id,
                  label: a.label,
                  prompt: a.prompt,
                }))}
                onSelect={(a) => onSubmit(a.prompt)}
                disabled={loading}
                variant="compact"
              />
            </div>
          )}

          <MissionPlanningBar
            visible={showPlanning && !loading}
            actions={[
              { label: "Simulate", prompt: "Simulate this allocation — show recipients and amounts." },
              { label: "Adjust weights", prompt: "Shift 10% from infrastructure to contributors." },
              { label: "Capital Blueprint", prompt: "Generate a Capital Blueprint for this community." },
            ]}
            onAction={onSubmit}
          />

          <MissionExecuteBar
            visible={showExecute && !loading}
            actions={[
              { label: "Review package", prompt: "Walk me through exactly what capital would move." },
              { label: "Prepare settlement", prompt: "Prepare settlement package for approval." },
              { label: "Authorize", prompt: "Authorize settlement now." },
            ]}
            onAction={onSubmit}
          />

          {!showPlanning && !showExecute && (
            <form onSubmit={handleFormSubmit} className="mx-auto max-w-2xl">
              <div className="relative">
                <input
                  value={input}
                  onChange={(e) => onInputChange(e.target.value)}
                  placeholder="Continue the mission…"
                  disabled={loading}
                  className="w-full rounded-xl border border-white/[0.1] bg-[#0a0f18]/90 px-4 py-3 pr-12 text-sm text-white placeholder:text-resolve-muted-dim focus:border-white/20 focus:outline-none disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg bg-white text-black transition hover:bg-white/90 disabled:opacity-30"
                  aria-label="Send"
                >
                  {loading ?
                    <Loader2 className="h-4 w-4 animate-spin" />
                  : <Send className="h-4 w-4" />}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {displayTopic && (
        <MissionContextPanel
          topicName={displayTopic.name}
          topicKind={displayTopic.kind === "general" ? "oss" : displayTopic.kind}
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
          operatingMode={operatingMode}
          loopPhase={loopPhase}
        />
      )}
    </div>
  );
}
