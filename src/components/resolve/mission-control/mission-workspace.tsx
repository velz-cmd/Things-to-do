"use client";

import { useEffect, useRef, useState } from "react";
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
import { MissionCreatorValuePanel } from "@/components/resolve/mission-control/mission-creator-value-panel";
import { MissionFunderToolsPanel } from "@/components/resolve/mission-control/mission-funder-tools-panel";
import { MissionCapitalAssemblyLine } from "@/components/resolve/mission-control/mission-capital-assembly-line";
import { MissionCommandBar } from "@/components/resolve/mission-control/mission-command-bar";
import { MissionPromptField } from "@/components/resolve/mission-control/mission-prompt-field";
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
  onSessionDeleted,
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
  scopePromptHint,
  onAcceptScopeHint,
  onDismissScopeHint,
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
  onSessionDeleted?: (sessionId: string) => void;
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
  scopePromptHint?: string | null;
  onAcceptScopeHint?: () => void;
  onDismissScopeHint?: () => void;
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

  if (!started) {
    return (
      <MissionEmptyState
        input={input}
        onInputChange={onInputChange}
        onSubmit={onSubmit}
        loading={loading}
        onNewMission={onNewMission}
        onSelectSession={onSelectSession}
        onSessionDeleted={onSessionDeleted}
        activeSessionId={activeSessionId}
        libraryTick={libraryTick}
        scopeHint={scopePromptHint}
        onAcceptScopeHint={onAcceptScopeHint}
        onDismissScopeHint={onDismissScopeHint}
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
    <div className="mission-workspace-shell flex h-[calc(100vh-3.75rem)] min-h-[560px]">
      <MissionHistorySidebar
        onNewMission={onNewMission}
        onSelectSession={onSelectSession}
        onSessionDeleted={onSessionDeleted}
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
            <MissionCapitalAssemblyLine
              loading={loading}
              thinkingComplete={thinkingComplete}
              missionPhase={phase}
              loopPhase={loopPhase}
              turns={turns}
              blueprintActive={blueprintActive}
              simulated={simulated}
              compact={!blueprintActive}
            />

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

        <div className="shrink-0 border-t border-resolve-border/60 bg-[#0a0f18]/85 px-4 py-3 backdrop-blur-md lg:px-8">
          {blueprintActive && blueprintCommand?.handle ? (
            <MissionCommandBar
              handle={blueprintCommand.handle}
              authorizing={blueprintCommand.handle.state.authorizing}
              className="max-w-4xl"
            />
          ) : (
            <>
              {!showPlanning && !showExecute && (
                <div className="mx-auto mb-3 max-w-4xl space-y-3">
                  <MissionCreatorValuePanel onTryPrompt={onSubmit} loading={loading} />
                  <MissionFunderToolsPanel onSubmit={onSubmit} loading={loading} />
                </div>
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
                <MissionPromptField
                  className="mx-auto max-w-4xl"
                  value={input}
                  onChange={onInputChange}
                  onSubmit={() => onSubmit(input.trim())}
                  loading={loading}
                  placeholder="Refine objective or run another signal…"
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
