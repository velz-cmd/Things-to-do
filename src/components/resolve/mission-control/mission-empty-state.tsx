"use client";

import { useState, type FormEvent } from "react";
import { Bot, ChevronDown, Loader2, Send } from "lucide-react";
import { MissionCommandHero } from "@/components/resolve/mission-control/mission-command-hero";
import { MissionLivePanel } from "@/components/resolve/mission-control/mission-live-panel";
import { MissionHistorySidebar } from "@/components/resolve/mission-control/mission-history-sidebar";
import { MissionSignalRailsPanel } from "@/components/resolve/mission-control/mission-signal-rails-panel";
import { useMissionScope } from "@/lib/mission/mission-context";
import { resolveMissionCommunitySlug } from "@/lib/mission/mission-community-slug";
import { formatAgentPrice } from "@/lib/agent/agent-signal-format";
import { MissionTemplateTiles } from "@/components/resolve/mission-control/mission-template-tiles";
import { MISSION_JOBS } from "@/lib/mission/mission-lane-copy";

const AGENT_EXAMPLES = [
  {
    label: "Docs review",
    prompt: "Run intel on React maintainers — docs gaps and contributor health",
    price: 0.02,
  },
  {
    label: "Sentiment",
    prompt: "Classify sentiment for maintainer feedback: love the DX but docs lag behind releases.",
    price: 0.001,
  },
];

export function MissionEmptyState({
  input,
  onInputChange,
  onSubmit,
  loading,
  onNewMission,
  onSelectSession,
  activeSessionId,
  libraryTick,
}: {
  input: string;
  onInputChange: (v: string) => void;
  onSubmit: (text: string) => void;
  loading?: boolean;
  onNewMission: () => void;
  onSelectSession: (session: import("@/lib/mission/toolbox/mission-library").MissionSession) => void;
  activeSessionId?: string | null;
  libraryTick?: number;
}) {
  const { scope } = useMissionScope();
  const [showMore, setShowMore] = useState(false);
  const communitySlug = resolveMissionCommunitySlug({
    scopeLabel: scope?.label,
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    onSubmit(input.trim());
  }

  const secondaryJobs = MISSION_JOBS.filter(
    (j) => j.id !== "fund" && j.id !== "simulate" && j.id !== "agent",
  );

  return (
    <div className="flex h-[calc(100vh-3.75rem)] min-h-[560px] bg-[#0a1020]/40">
      <MissionHistorySidebar
        onNewMission={onNewMission!}
        onSelectSession={onSelectSession!}
        activeSessionId={activeSessionId}
        libraryVersion={libraryTick}
      />

      <div className="min-w-0 flex-1 overflow-y-auto px-4 py-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <MissionCommandHero onSubmit={onSubmit} />

          <form onSubmit={handleSubmit} className="mt-5">
            <div className="relative">
              <input
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
                placeholder="Name a community and objective — or pick an intent above"
                disabled={loading}
                autoFocus
                className="w-full rounded-xl border border-white/[0.1] bg-[#0a0f18]/90 px-4 py-3.5 pr-12 text-sm text-white placeholder:text-resolve-muted-dim focus:border-sky-500/40 focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg bg-white text-black transition hover:bg-white/90 disabled:opacity-30"
                aria-label="Submit"
              >
                {loading ?
                  <Loader2 className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />}
              </button>
            </div>
          </form>

          <MissionTemplateTiles onSubmit={onSubmit} className="mt-5" />

          <div className="mt-6">
            <details className="rounded-xl border border-white/[0.06] bg-[#0a0f18]/50 open:pb-3">
              <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-xs font-medium text-resolve-muted marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="inline-flex items-center gap-1.5">
                  <Bot className="h-3.5 w-3.5 text-violet-300" />
                  Hire intel — agent signals
                </span>
                <ChevronDown className="h-3.5 w-3.5 opacity-50" />
              </summary>
              <ul className="mt-1 space-y-1.5 px-2 pb-2">
                {AGENT_EXAMPLES.map((ex) => (
                  <li key={ex.label}>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => onSubmit(ex.prompt)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-left transition hover:border-violet-500/25 hover:bg-violet-500/[0.04] disabled:opacity-40"
                    >
                      <span className="text-sm text-white/90">{ex.label}</span>
                      <span className="text-xs font-semibold tabular-nums text-emerald-300">
                        {formatAgentPrice(ex.price)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          </div>

          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="mt-4 text-xs text-resolve-muted hover:text-white"
          >
            {showMore ? "Hide" : "More"} mission types
          </button>

          {showMore && (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap gap-2">
                {secondaryJobs.map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    disabled={loading}
                    onClick={() => onSubmit(job.prompt)}
                    className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-xs text-resolve-muted transition hover:border-white/20 hover:text-white disabled:opacity-40"
                  >
                    {job.who}
                  </button>
                ))}
              </div>
              <details className="rounded-xl border border-white/[0.06] bg-[#0a0f18]/50 open:pb-3">
                <summary className="cursor-pointer list-none px-3 py-2 text-xs text-resolve-muted marker:content-none [&::-webkit-details-marker]:hidden">
                  Full signal catalog
                </summary>
                <div className="px-2 pb-2">
                  <MissionSignalRailsPanel onMissionPrompt={(prompt) => onSubmit(prompt)} />
                </div>
              </details>
            </div>
          )}
        </div>
      </div>

      <MissionLivePanel
        topicName={scope?.label}
        communitySlug={communitySlug}
        missionPhase="discover"
        loopPhase="observe"
        className="hidden lg:flex"
      />
    </div>
  );
}
