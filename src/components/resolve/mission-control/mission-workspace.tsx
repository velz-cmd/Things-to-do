"use client";

import { useEffect, useRef, type FormEvent, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { MissionThinking } from "@/components/resolve/mission-control/mission-thinking";
import { MissionEmptyState } from "@/components/resolve/mission-control/mission-empty-state";
import { MissionHistorySidebar } from "@/components/resolve/mission-control/mission-history-sidebar";
import { MissionReportCard } from "@/components/resolve/mission-control/mission-report-card";
import { MissionContextPanel } from "@/components/resolve/mission-control/mission-context-panel";
import { MissionWorldSnapshot } from "@/components/resolve/mission-control/mission-world-snapshot";
import {
  MissionUserBubble,
  MissionResolveBubble,
  MissionThinkingBubble,
} from "@/components/resolve/mission-control/mission-chat-bubble";
import { MissionEvidencePanel } from "@/components/resolve/mission-control/mission-evidence-panel";
import {
  MissionPlanningBar,
  MissionExecuteBar,
} from "@/components/resolve/mission-control/mission-planning-bar";
import { MissionOperatingMode } from "@/components/resolve/mission-control/mission-operating-mode";
import { MissionAgentSignalCard } from "@/components/resolve/mission-control/mission-agent-signal-card";
import { MissionSignalRailsPanel } from "@/components/resolve/mission-control/mission-signal-rails-panel";
import { MissionAiProvidersPanel } from "@/components/resolve/mission-control/mission-ai-providers-panel";
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
  const started = Boolean(objective || turns.length > 0 || loading);
  const lastResolve = [...turns].reverse().find((t) => t.role === "resolve");
  const lastAllocations = lastResolve?.allocations;
  const showPlanning = shouldShowPlanningBar(phase);
  const showExecute = shouldShowExecuteBar(phase);
  const lastReport = lastResolve?.report;
  const [evidenceCount, setEvidenceCount] = useState(0);
  const executeBlocked = showExecute && evidenceCount < 1;

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
    <div className="flex h-[calc(100vh-3.75rem)] min-h-[560px] bg-[#0a1020]/40">
      <MissionHistorySidebar
        onNewMission={onNewMission}
        onSelectSession={onSelectSession}
        activeSessionId={activeSessionId}
        libraryVersion={libraryTick}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {displayTopic && displayTopic.kind !== "general" && (
          <MissionWorldSnapshot
            topic={displayTopic.name}
            kind={displayTopic.kind}
            report={lastReport}
          />
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 lg:px-8">
          <div className="mx-auto max-w-2xl space-y-5">
            {turns.map((turn) =>
              turn.role === "user" ?
                <MissionUserBubble key={turn.id}>{turn.text}</MissionUserBubble>
              : <MissionResolveBubble key={turn.id}>
                  {turn.agentSignal ?
                    <div className="space-y-3">
                      <p className="text-sm text-resolve-muted">{turn.text}</p>
                      <MissionAgentSignalCard
                        prompt={turn.agentSignal.prompt}
                        initialServiceId={turn.agentSignal.serviceId}
                        onFollowUp={turn === lastResolve ? onSubmit : undefined}
                      />
                    </div>
                  : turn.report ?
                    <MissionReportCard
                      report={turn.report}
                      onAction={turn === lastResolve ? onAction : undefined}
                      actionsDisabled={loading}
                    />
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
                </MissionResolveBubble>,
            )}

            {loading && (
              <MissionThinkingBubble>
                <MissionThinking
                  active={loading}
                  complete={thinkingComplete}
                  steps={thinkingSteps}
                />
              </MissionThinkingBubble>
            )}
            <div ref={endRef} />
          </div>
        </div>

        <div className="shrink-0 border-t border-white/[0.06] bg-[#070b14]/60 px-4 py-3 backdrop-blur-md lg:px-8">
          <div className="mx-auto mb-3 max-w-2xl space-y-3">
            <details className="group rounded-xl border border-white/[0.06] bg-[#0a0f18]/50 open:pb-3">
              <summary className="cursor-pointer list-none px-3 py-2 text-[11px] font-medium text-resolve-muted marker:content-none [&::-webkit-details-marker]:hidden">
                Mission AI — Gemini, Llama, OpenRouter
              </summary>
              <div className="px-2">
                <MissionAiProvidersPanel className="border-0 bg-transparent px-2 py-2" />
              </div>
            </details>
            <MissionSignalRailsPanel
              onMissionPrompt={(prompt) => onSubmit(prompt)}
            />
          </div>
          {onOperatingModeChange && (
            <div className="mx-auto mb-3 max-w-2xl">
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
                id: "adjust-weights",
                label: "Adjust weights",
                prompt: "Shift 10% from infrastructure to contributors.",
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
                id: "prepare-settlement-bar",
                label: "Prepare settlement",
                prompt: "Prepare settlement package for approval.",
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
            <form onSubmit={handleFormSubmit} className="mx-auto max-w-2xl">
              <div className="relative">
                <input
                  value={input}
                  onChange={(e) => onInputChange(e.target.value)}
                  placeholder="Ask anything — run intel, fund maintainers, risk, claims, settlement…"
                  disabled={loading}
                  className="w-full rounded-2xl border border-white/[0.1] bg-[#131c2e]/90 px-4 py-3 pr-12 text-sm text-white placeholder:text-resolve-muted-dim focus:border-sky-500/40 focus:outline-none disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl bg-white text-black transition hover:bg-white/90 disabled:opacity-30"
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

      {displayTopic && lastReport && (
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
