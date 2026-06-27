"use client";

import { useEffect, useRef, type FormEvent } from "react";
import { Loader2, Mic, Send } from "lucide-react";
import { MissionThinking } from "@/components/resolve/mission-control/mission-thinking";
import {
  MissionFundingLeaks,
  MissionInlinePolicy,
  MissionSuggestedAllocation,
  MissionTreasurySnippet,
  type AllocationLine,
} from "@/components/resolve/mission-control/mission-recommendation";
import {
  MissionExecutionBar,
  MissionQuickReplies,
} from "@/components/resolve/mission-control/mission-execution-bar";
import { MISSION_EXAMPLES } from "@/lib/mission/intents";
import type { OpportunityCard } from "@/lib/workspace/advisors/opportunity-cards";
import type { PolicyProposal } from "@/lib/workspace/advisors/policy-proposals";

export type MissionTurn = {
  id: string;
  role: "user" | "resolve";
  text: string;
  opportunities?: OpportunityCard[];
  opportunitiesTitle?: string;
  allocations?: AllocationLine[];
  policy?: PolicyProposal;
  treasury?: { availableUsd: number; neededUsd: number };
  quickReplies?: string[];
  showExecution?: boolean;
};

const IDLE_EXAMPLES = MISSION_EXAMPLES;

export function MissionWorkspace({
  started,
  turns,
  loading,
  thinkingComplete,
  input,
  onInputChange,
  onSubmit,
  onQuickReply,
  onApprove,
  onSimulate,
  onReject,
  onEditPolicy,
  thinkingSteps,
}: {
  started: boolean;
  turns: MissionTurn[];
  loading: boolean;
  thinkingComplete: boolean;
  input: string;
  onInputChange: (v: string) => void;
  onSubmit: (text: string) => void;
  onQuickReply: (text: string) => void;
  onApprove?: () => void;
  onSimulate?: () => void;
  onReject?: () => void;
  onEditPolicy?: () => void;
  thinkingSteps?: readonly string[];
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const lastResolve = [...turns].reverse().find((t) => t.role === "resolve");
  const showExecution = Boolean(lastResolve?.showExecution && !loading);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, loading, thinkingComplete]);

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    onSubmit(input.trim());
  }

  return (
    <div className="flex h-[calc(100vh-3.75rem)] min-h-[560px] flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-8 lg:px-6">
          {!started && (
            <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-resolve-accent">
                Mission
              </p>
              <h1 className="mt-4 text-2xl font-medium tracking-tight text-white sm:text-3xl">
                What would you like RESOLVE to do?
              </h1>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-resolve-muted">
                Ask about any open community — value, risk, funding, claims, dependencies.
                RESOLVE observes, understands, recommends, and executes when you approve.
              </p>
              <form onSubmit={handleFormSubmit} className="mt-8 w-full max-w-xl">
                <div className="relative">
                  <input
                    value={input}
                    onChange={(e) => onInputChange(e.target.value)}
                    placeholder="I have $100k — who deserves it?"
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
                  onSelect={onQuickReply}
                  className="justify-center"
                />
              </div>
            </div>
          )}

          {started && (
            <div className="space-y-6">
              {turns.map((turn) => (
                <article key={turn.id}>
                  {turn.role === "user" ?
                    <div className="flex justify-end">
                      <p className="max-w-[85%] rounded-2xl border border-resolve-border/60 bg-white/[0.06] px-4 py-2.5 text-sm text-white">
                        {turn.text}
                      </p>
                    </div>
                  : <div className="space-y-4">
                      <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-white/95">
                        {turn.text}
                      </p>

                      {turn.policy && (
                        <MissionInlinePolicy policy={turn.policy} onEdit={onEditPolicy} />
                      )}

                      {turn.opportunities && turn.opportunities.length > 0 && (
                        <MissionFundingLeaks
                          opportunities={turn.opportunities}
                          title={turn.opportunitiesTitle}
                        />
                      )}

                      {turn.allocations && turn.allocations.length > 0 && (
                        <MissionSuggestedAllocation lines={turn.allocations} />
                      )}

                      {turn.treasury && (
                        <MissionTreasurySnippet
                          availableUsd={turn.treasury.availableUsd}
                          neededUsd={turn.treasury.neededUsd}
                        />
                      )}

                      {turn.quickReplies && turn.quickReplies.length > 0 && (
                        <MissionQuickReplies
                          options={turn.quickReplies}
                          onSelect={onQuickReply}
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
                  {!thinkingComplete && (
                    <div className="flex items-center gap-2 text-sm text-resolve-muted">
                      <Loader2 className="h-4 w-4 animate-spin text-resolve-accent" />
                      Building your mission…
                    </div>
                  )}
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
                placeholder="Continue the mission…"
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
        </div>
      )}

      <MissionExecutionBar
        visible={showExecution}
        onApprove={onApprove}
        onSimulate={onSimulate}
        onReject={onReject}
      />
    </div>
  );
}
