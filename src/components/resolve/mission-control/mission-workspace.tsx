"use client";

import { useEffect, useRef, type FormEvent, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { MissionEmptyState } from "@/components/resolve/mission-control/mission-empty-state";
import { MissionThinkingBubble } from "@/components/resolve/mission-control/mission-chat-bubble";
import { MissionHistorySidebar } from "@/components/resolve/mission-control/mission-history-sidebar";
import { MissionReportCard } from "@/components/resolve/mission-control/mission-report-card";
import { MissionWorldSnapshot } from "@/components/resolve/mission-control/mission-world-snapshot";
import {
  MissionArtifactStage,
  MissionPriorTurn,
  MissionPromptLine,
} from "@/components/resolve/mission-control/mission-artifact-stage";
import { MissionEvidencePanel } from "@/components/resolve/mission-control/mission-evidence-panel";
import {
  MissionPlanningBar,
  MissionExecuteBar,
} from "@/components/resolve/mission-control/mission-planning-bar";
import { MissionOperatingMode } from "@/components/resolve/mission-control/mission-operating-mode";
import { MissionAgentSignalCard } from "@/components/resolve/mission-control/mission-agent-signal-card";
import { MissionBlueprintPanel } from "@/components/resolve/mission-control/mission-blueprint-panel";
import { MissionCommunalPoolPanel } from "@/components/resolve/mission-control/mission-communal-pool-panel";
import { MissionBatchAllocationPanel } from "@/components/resolve/mission-control/mission-batch-allocation-panel";
import { MissionObjectiveBar } from "@/components/resolve/mission-control/mission-objective-bar";
import { MissionProgressStepCard } from "@/components/resolve/mission-control/mission-progress-step-card";
import { MissionSignalRailsPanel } from "@/components/resolve/mission-control/mission-signal-rails-panel";
import { MissionCommandBar } from "@/components/resolve/mission-control/mission-command-bar";
import { useMissionBlueprintCommand } from "@/components/resolve/mission-control/mission-blueprint-command-context";
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
import { resolveMissionCommunitySlug } from "@/lib/mission/mission-community-slug";
import { useMissionScope } from "@/lib/mission/mission-context";

export type MissionAgentSignalTurn = {
  prompt: string;
  serviceId?: string;
};

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
  agentSignal?: MissionAgentSignalTurn;
  blueprint?: { prompt: string; initialBudgetUsd?: number };
  communalPool?: { prompt: string; communitySlug?: string };
  batchAllocation?: { prompt: string; communitySlug?: string; initialBudgetUsd?: number };
};

function isArtifactTurn(turn: MissionTurn): boolean {
  return Boolean(
    turn.blueprint || turn.agentSignal || turn.report || turn.brief || turn.communalPool || turn.batchAllocation,
  );
}

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
  missionId = null,
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
  onOperatingModeChange,
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
  missionId?: string | null;
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
  onOperatingModeChange?: (mode: OperatingMode) => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const { scope } = useMissionScope();
  const started = Boolean(objective || turns.length > 0 || loading);
  const lastResolve = [...turns].reverse().find((t) => t.role === "resolve");
  const lastAllocations = lastResolve?.allocations;
  const hasBlueprintTurn = turns.some((t) => t.role === "resolve" && Boolean(t.blueprint));
  const blueprintCommand = useMissionBlueprintCommand();
  const blueprintActive =
    hasBlueprintTurn || Boolean(blueprintCommand?.handle);
  const simulated = blueprintCommand?.handle?.state.simulated ?? false;
  const showPlanning = shouldShowPlanningBar(phase) && !blueprintActive;
  const showExecute = shouldShowExecuteBar(phase) && !blueprintActive;
  const lastReport = lastResolve?.report;
  const displayTopic = topic ?? (objective ? { name: objective.slice(0, 48), kind: "general" as const } : null);
  const communitySlug = resolveMissionCommunitySlug({
    topicName: displayTopic?.name,
    scopeLabel: scope?.label ?? objective,
  });
  const [evidenceCount, setEvidenceCount] = useState(0);
  const executeBlocked = showExecute && evidenceCount < 1;

  const lastArtifactIndex = turns.findLastIndex(
    (t) => t.role === "resolve" && isArtifactTurn(t),
  );

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
        onNewMission={onNewMission}
        onSelectSession={onSelectSession}
        activeSessionId={activeSessionId}
        libraryTick={libraryTick}
      />
    );
  }


  function renderResolveTurn(turn: MissionTurn, isCurrent: boolean) {
    if (turn.communalPool) {
      return (
        <MissionArtifactStage label="Communal pool">
          <MissionCommunalPoolPanel
            communitySlug={
              turn.communalPool.communitySlug ??
              communitySlug ??
              "react"
            }
            prompt={turn.communalPool.prompt}
          />
        </MissionArtifactStage>
      );
    }

    if (turn.batchAllocation) {
      return (
        <MissionArtifactStage label="Batch allocation">
          <MissionBatchAllocationPanel
            prompt={turn.batchAllocation.prompt}
            communitySlug={turn.batchAllocation.communitySlug ?? communitySlug}
            initialBudgetUsd={turn.batchAllocation.initialBudgetUsd}
          />
        </MissionArtifactStage>
      );
    }

    if (turn.blueprint) {
      return (
        <MissionArtifactStage label="Blueprint">
          {turn.text && (
            <p className="mb-3 text-sm text-resolve-muted">{turn.text}</p>
          )}
          <MissionBlueprintPanel
            prompt={turn.blueprint.prompt}
            mode="scope"
            initialBudgetUsd={turn.blueprint.initialBudgetUsd}
            communitySlug={communitySlug}
            commandBarMode
            registerCommand={isCurrent}
          />
        </MissionArtifactStage>
      );
    }

    if (turn.agentSignal) {
      return (
        <MissionArtifactStage label="Agent signal">
          {turn.text && (
            <p className="mb-3 text-sm text-resolve-muted">{turn.text}</p>
          )}
          <MissionAgentSignalCard
            prompt={turn.agentSignal.prompt}
            initialServiceId={turn.agentSignal.serviceId}
            onFollowUp={isCurrent ? onSubmit : undefined}
          />
        </MissionArtifactStage>
      );
    }

    if (turn.report) {
      return (
        <MissionArtifactStage label="Mission report">
          <MissionReportCard
            report={turn.report}
            onAction={isCurrent ? onAction : undefined}
            actionsDisabled={loading}
          />
        </MissionArtifactStage>
      );
    }

    if (turn.brief) {
      return (
        <MissionArtifactStage label="Intelligence brief">
          <MissionReportCard
            report={reportFromBrief(
              turn.brief,
              objective ?? turn.text,
              turn.nextSteps ?? [],
            )}
            onAction={isCurrent ? onAction : undefined}
            actionsDisabled={loading}
          />
        </MissionArtifactStage>
      );
    }

    return <p className="text-sm text-resolve-muted">{turn.text}</p>;
  }

  return (
    <div className="flex h-[calc(100vh-3.75rem)] min-h-[560px] bg-[#0a1020]/40">
      <MissionHistorySidebar
        onNewMission={onNewMission}
        onSelectSession={onSelectSession}
        activeSessionId={activeSessionId}
        libraryVersion={libraryTick}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {objective && (
          <MissionObjectiveBar
            objective={objective}
            loopPhase={loopPhase}
            blueprintActive={blueprintActive}
            simulated={simulated}
          />
        )}


        {displayTopic && displayTopic.kind !== "general" && (
          <div className="mx-auto w-full max-w-4xl px-4 lg:px-8">
            <MissionWorldSnapshot
              topic={displayTopic.name}
              kind={displayTopic.kind}
              report={lastReport}
            />
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 lg:px-8">
          <div className="mx-auto max-w-4xl space-y-4">
            {turns.map((turn, index) => {
              const isCurrentArtifact =
                turn.role === "resolve" && index === lastArtifactIndex;

              if (turn.role === "user") {
                if (index < lastArtifactIndex - 1) {
                  return (
                    <MissionPriorTurn key={turn.id} prompt={turn.text} />
                  );
                }
                return (
                  <MissionPromptLine key={turn.id}>{turn.text}</MissionPromptLine>
                );
              }

              if (!isCurrentArtifact && isArtifactTurn(turn)) {
                const summary =
                  turn.blueprint
                    ? "Blueprint"
                    : turn.agentSignal
                      ? "Agent signal"
                      : "Report";
                return (
                  <MissionPriorTurn
                    key={turn.id}
                    prompt={turn.text || summary}
                    summary={summary}
                  />
                );
              }

              return (
                <div key={turn.id}>{renderResolveTurn(turn, isCurrentArtifact)}</div>
              );
            })}

            {loading && (
              <MissionThinkingBubble>
                <MissionProgressStepCard
                  active
                  complete={thinkingComplete}
                  title="Working on your mission"
                  steps={thinkingSteps}
                />
              </MissionThinkingBubble>
            )}
            <div ref={endRef} />
          </div>
        </div>

        <div className="shrink-0 border-t border-white/[0.06] bg-[#070b14]/80 px-4 py-3 backdrop-blur-md lg:px-8">
          {blueprintActive && blueprintCommand?.handle ? (
            <MissionCommandBar
              handle={blueprintCommand.handle}
              authorizing={blueprintCommand.handle.state.authorizing}
              className="max-w-4xl"
            />
          ) : (
            <>
              {!showPlanning && !showExecute && (
                <details className="mx-auto mb-3 max-w-4xl rounded-xl border border-white/[0.06] bg-[#0a0f18]/50 open:pb-3">
                  <summary className="cursor-pointer list-none px-3 py-2 text-xs text-resolve-muted marker:content-none [&::-webkit-details-marker]:hidden">
                    Hire intel — agent signals
                  </summary>
                  <div className="px-2">
                    <MissionSignalRailsPanel onMissionPrompt={(prompt) => onSubmit(prompt)} />
                  </div>
                </details>
              )}

              {onOperatingModeChange && !blueprintActive && (
                <div className="mx-auto mb-3 max-w-4xl">
                  <MissionOperatingMode
                    active={operatingMode}
                    onChange={onOperatingModeChange}
                    disabled={loading}
                  />
                </div>
              )}

              <MissionEvidencePanel
                visible={showPlanning || showExecute}
                missionId={missionId}
                onEvidenceCount={setEvidenceCount}
              />

              <MissionPlanningBar
                visible={showPlanning && !loading}
                actions={[
                  {
                    id: "simulate-plan",
                    label: "Simulate",
                    prompt: "Simulate this allocation — show recipients and amounts.",
                    kind: "simulate",
                  },
                  {
                    id: "blueprint-plan",
                    label: "Capital Blueprint",
                    prompt: "Generate a Capital Blueprint for this community.",
                    kind: "plan",
                  },
                ]}
                onAction={onAction}
              />

              <MissionExecuteBar
                visible={showExecute && !loading}
                executeBlocked={executeBlocked}
                blockReason="Connect sensors or wait for ledger rows before authorizing settlement."
                actions={[
                  {
                    id: "review-package-bar",
                    label: "Review package",
                    prompt: "Walk me through exactly what capital would move.",
                    kind: "execute",
                    actionType: "prepare_settlement",
                  },
                  {
                    id: "authorize-bar",
                    label: "Authorize",
                    prompt: "Authorize settlement now.",
                    kind: "execute",
                    actionType: "execute_settlement",
                  },
                ]}
                onAction={onAction}
              />

              {!showPlanning && !showExecute && (
                <form onSubmit={handleFormSubmit} className="mx-auto max-w-4xl">
                  <div className="relative">
                    <input
                      value={input}
                      onChange={(e) => onInputChange(e.target.value)}
                      placeholder="Refine objective or run another signal…"
                      disabled={loading}
                      className="w-full rounded-xl border border-white/[0.1] bg-[#0a0f18]/90 px-4 py-3 pr-12 text-sm text-white placeholder:text-resolve-muted-dim focus:border-sky-500/40 focus:outline-none disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={loading || !input.trim()}
                      className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg bg-white text-black transition hover:bg-white/90 disabled:opacity-30"
                      aria-label="Send"
                    >
                      {loading ?
                        <Loader2 className="h-4 w-4 animate-spin" />
                      : <Send className="h-4 w-4" />}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
