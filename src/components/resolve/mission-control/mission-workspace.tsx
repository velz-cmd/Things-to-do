"use client";

import { useEffect, useRef, type FormEvent } from "react";
import { Loader2, Mic, Send } from "lucide-react";
import { MissionThinking } from "@/components/resolve/mission-control/mission-thinking";
import { MissionFindings } from "@/components/resolve/mission-control/mission-findings";
import {
  MissionInlinePolicy,
  MissionSuggestedAllocation,
} from "@/components/resolve/mission-control/mission-recommendation";
import { MissionQuickReplies } from "@/components/resolve/mission-control/mission-execution-bar";
import { MissionSidebar } from "@/components/resolve/mission-control/mission-sidebar";
import { MissionNextSteps } from "@/components/resolve/mission-control/mission-next-steps";
import { MISSION_EXAMPLES } from "@/lib/mission/intents";
import type { MissionFinding } from "@/lib/workspace/advisors/intelligence-findings";
import type { MissionPhase } from "@/lib/mission/phases";
import type { CapabilityAction, CapabilityId } from "@/lib/mission/capabilities/types";
import type { AllocationLine } from "@/components/resolve/mission-control/mission-recommendation";
import type { Ecosystem } from "@/lib/mission/ecosystems";
import type { KnowledgeEntry } from "@/lib/mission/knowledge";
import type { PolicyProposal } from "@/lib/workspace/advisors/policy-proposals";
import { statusLabel } from "@/lib/mission/state-machine";
import type { MissionStatus } from "@/lib/mission/state-machine";

export type MissionTurn = {
  id: string;
  role: "user" | "resolve";
  text: string;
  findings?: MissionFinding[];
  phase?: MissionPhase;
  capability?: CapabilityId;
  allocations?: AllocationLine[];
  policy?: PolicyProposal;
  nextSteps?: CapabilityAction[];
};

const IDLE_EXAMPLES = MISSION_EXAMPLES;

export function MissionWorkspace({
  started,
  turns,
  loading,
  thinkingComplete,
  phase,
  input,
  onInputChange,
  onSubmit,
  onChip,
  onAction,
  onNewMission,
  onSelectSession,
  onSelectEcosystem,
  onSelectKnowledge,
  activeSessionId,
  activeEcosystem,
  missionStatus,
  onClear,
  thinkingSteps,
  libraryTick,
}: {
  started: boolean;
  turns: MissionTurn[];
  loading: boolean;
  thinkingComplete: boolean;
  phase: MissionPhase;
  input: string;
  onInputChange: (v: string) => void;
  onSubmit: (text: string) => void;
  onChip: (text: string) => void;
  onAction?: (action: CapabilityAction) => void;
  onNewMission: () => void;
  onSelectSession: (session: import("@/lib/mission/toolbox/mission-library").MissionSession) => void;
  onSelectEcosystem: (ecosystem: Ecosystem | null) => void;
  onSelectKnowledge: (entry: KnowledgeEntry) => void;
  activeSessionId?: string | null;
  activeEcosystem?: Ecosystem | null;
  missionStatus?: string | null;
  onClear?: () => void;
  thinkingSteps?: readonly string[];
  libraryTick?: number;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const lastResolveIdx = turns.map((t, i) => (t.role === "resolve" ? i : -1)).filter((i) => i >= 0).pop();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, loading, thinkingComplete]);

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    onSubmit(input.trim());
  }

  const inputPlaceholder =
    activeEcosystem ? `Ask about ${activeEcosystem.name}…` : "Ask a follow-up…";

  return (
    <div className="flex h-[calc(100vh-3.75rem)] min-h-[560px]">
      <MissionSidebar
        onNewMission={onNewMission}
        onSelectSession={onSelectSession}
        onSelectEcosystem={onSelectEcosystem}
        onSelectKnowledge={onSelectKnowledge}
        activeSessionId={activeSessionId}
        activeEcosystemId={activeEcosystem?.id ?? null}
        libraryVersion={libraryTick}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {missionStatus && started && (
          <div className="shrink-0 border-b border-resolve-border/30 px-4 py-2 lg:px-6">
            <p className="mx-auto max-w-2xl text-[11px] text-resolve-muted-dim">
              Mission state:{" "}
              <span className="text-resolve-accent/90">
                {statusLabel(missionStatus as MissionStatus)}
              </span>
              {activeEcosystem?.repos && activeEcosystem.repos.length > 0 && (
                <span className="text-resolve-muted-dim">
                  {" "}
                  · {activeEcosystem.repos.length} attached repos
                </span>
              )}
            </p>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-4 py-8 lg:px-6">
            {!started && (
              <div className="relative flex min-h-[50vh] flex-col items-center justify-center text-center">
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-48 w-48 rounded-full bg-resolve-accent/5 blur-3xl" />
                </div>
                <p className="relative text-[10px] font-semibold uppercase tracking-[0.22em] text-resolve-accent">
                  Mission
                </p>
                <h1 className="relative mt-4 text-2xl font-medium tracking-tight text-white sm:text-3xl">
                  What would you like RESOLVE to do?
                </h1>
                <p className="relative mt-3 max-w-md text-sm leading-relaxed text-resolve-muted">
                  Economic intelligence for any open community — ask, discover, decide.
                </p>
                <form onSubmit={handleFormSubmit} className="mt-8 w-full max-w-xl">
                  <div className="relative">
                    <input
                      value={input}
                      onChange={(e) => onInputChange(e.target.value)}
                      placeholder={
                        activeEcosystem ?
                          `Where is value leaking in ${activeEcosystem.name}?`
                        : "Find value leaks in React"
                      }
                      className="w-full rounded-full border border-resolve-border bg-resolve-bg-deep/60 px-5 py-3.5 pr-12 text-sm text-white placeholder:text-resolve-muted-dim focus:border-resolve-accent/50 focus:outline-none"
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={!input.trim()}
                      className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-resolve-muted transition hover:text-white disabled:opacity-30"
                      aria-label="Send"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </form>
                <div className="mt-6 w-full max-w-xl">
                  <p className="mb-3 text-[11px] text-resolve-muted-dim">Examples</p>
                  <MissionQuickReplies
                    options={[...IDLE_EXAMPLES]}
                    onSelect={onChip}
                    className="justify-center"
                  />
                </div>
              </div>
            )}

            {started && (
              <div className="space-y-6">
                {turns.map((turn, idx) => (
                  <article key={turn.id}>
                    {turn.role === "user" ?
                      <div className="flex justify-end">
                        <p className="max-w-[85%] rounded-2xl border border-resolve-border/60 bg-white/[0.06] px-4 py-2.5 text-sm text-white">
                          {turn.text}
                        </p>
                      </div>
                    : <div className="space-y-4">
                        <p className="text-[15px] font-medium leading-relaxed text-white/95">
                          {turn.text}
                        </p>

                        {turn.findings && turn.findings.length > 0 && (
                          <MissionFindings
                            findings={turn.findings}
                            onChip={onChip}
                            disabled={loading}
                          />
                        )}

                        {turn.policy && <MissionInlinePolicy policy={turn.policy} />}

                        {turn.allocations && turn.allocations.length > 0 && (
                          <MissionSuggestedAllocation lines={turn.allocations} />
                        )}

                        {idx === lastResolveIdx &&
                          turn.nextSteps &&
                          turn.nextSteps.length > 0 &&
                          !loading && (
                            <MissionNextSteps
                              actions={turn.nextSteps}
                              onSelect={onChip}
                              onAction={onAction}
                              disabled={loading}
                            />
                          )}
                      </div>
                    }
                  </article>
                ))}

                {loading && (
                  <div className="space-y-4">
                    <MissionThinking
                      active={loading}
                      complete={thinkingComplete}
                      steps={thinkingSteps}
                    />
                  </div>
                )}

                <div ref={endRef} />
              </div>
            )}
          </div>
        </div>

        {started && (
          <div className="shrink-0 border-t border-resolve-border/40 px-4 py-4 lg:px-6">
            <form onSubmit={handleFormSubmit} className="mx-auto flex max-w-2xl gap-2">
              <div className="relative min-w-0 flex-1">
                <input
                  value={input}
                  onChange={(e) => onInputChange(e.target.value)}
                  placeholder={inputPlaceholder}
                  disabled={loading}
                  className="w-full rounded-full border border-resolve-border bg-resolve-bg-deep/60 px-5 py-3 pr-12 text-sm text-white placeholder:text-resolve-muted-dim focus:border-resolve-accent/50 focus:outline-none disabled:opacity-50"
                />
                <button
                  type="button"
                  className="absolute right-11 top-1/2 -translate-y-1/2 text-resolve-muted-dim"
                  aria-hidden
                  tabIndex={-1}
                >
                  <Mic className="h-4 w-4 opacity-40" />
                </button>
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-resolve-muted transition hover:text-white disabled:opacity-30"
                  aria-label="Send"
                >
                  {loading ?
                    <Loader2 className="h-4 w-4 animate-spin" />
                  : <Send className="h-4 w-4" />}
                </button>
              </div>
            </form>
            {onClear && phase === "execute" && (
              <div className="mx-auto mt-2 max-w-2xl text-center">
                <button
                  type="button"
                  onClick={onClear}
                  className="text-[11px] text-resolve-muted-dim transition hover:text-white"
                >
                  Start a new mission
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
