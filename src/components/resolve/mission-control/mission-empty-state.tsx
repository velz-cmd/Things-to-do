"use client";

import { useState, type FormEvent } from "react";
import { Bot, Loader2, Send } from "lucide-react";
import { MissionCommandHero } from "@/components/resolve/mission-control/mission-command-hero";
import { MissionLivePanel } from "@/components/resolve/mission-control/mission-live-panel";
import { MissionHistorySidebar } from "@/components/resolve/mission-control/mission-history-sidebar";
import { MissionSignalRailsPanel } from "@/components/resolve/mission-control/mission-signal-rails-panel";
import { MissionAiProvidersPanel } from "@/components/resolve/mission-control/mission-ai-providers-panel";
import { useMissionScope } from "@/lib/mission/mission-context";
import { resolveMissionCommunitySlug } from "@/lib/mission/mission-community-slug";
import { MISSION_AGENT_LANE_COPY, MISSION_AGENT_PIPELINE, type MissionJobId } from "@/lib/mission/mission-lane-copy";
import { formatAgentPrice } from "@/lib/agent/agent-signal-format";

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
  {
    label: "Security signal",
    prompt: "Extract CVEs from this advisory: critical RCE in libxml2 before 2.12.0.",
    price: 0.1,
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
  onNewMission?: () => void;
  onSelectSession?: (session: import("@/lib/mission/toolbox/mission-library").MissionSession) => void;
  activeSessionId?: string | null;
  libraryTick?: number;
}) {
  const { scope } = useMissionScope();
  const [activeJob, setActiveJob] = useState<MissionJobId | null>(null);
  const communitySlug = resolveMissionCommunitySlug({
    scopeLabel: scope?.label,
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    onSubmit(input.trim());
  }

  return (
    <div className="flex h-[calc(100vh-3.75rem)] min-h-[560px] bg-[#0a1020]/40">
      {onNewMission && onSelectSession && (
        <MissionHistorySidebar
          onNewMission={onNewMission}
          onSelectSession={onSelectSession}
          activeSessionId={activeSessionId}
          libraryVersion={libraryTick}
        />
      )}

      <div className="min-w-0 flex-1 overflow-y-auto px-4 py-8 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <MissionCommandHero
            activeJob={activeJob}
            onSelectJob={setActiveJob}
            onSubmit={onSubmit}
          />

          <form onSubmit={handleSubmit} className="mt-6">
            <div className="relative">
              <input
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
                placeholder="Run intel, describe a funding objective, simulate settlement…"
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

          <p className="mt-4 rounded-xl border border-violet-500/20 bg-violet-500/[0.06] px-3 py-2 text-center text-xs font-medium leading-relaxed text-violet-100/95">
            {MISSION_AGENT_PIPELINE} — {MISSION_AGENT_LANE_COPY.tagline}
          </p>

          <div className="mt-8">
            <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">
              Agent signals · pay per verified context
            </p>
            <ul className="mt-3 space-y-2">
              {AGENT_EXAMPLES.map((ex) => (
                <li key={ex.label}>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => onSubmit(ex.prompt)}
                    className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-left transition hover:border-resolve-accent/25 hover:bg-resolve-accent/[0.04] disabled:opacity-40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-white/90">
                        <Bot className="h-3.5 w-3.5 text-resolve-accent" />
                        {ex.label}
                      </span>
                      <span className="text-xs font-semibold tabular-nums text-emerald-300">
                        {formatAgentPrice(ex.price)}
                      </span>
                    </div>
                    <span className="mt-0.5 block text-xs text-resolve-muted-dim">{ex.prompt}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-10 space-y-4">
            <MissionAiProvidersPanel />
            <MissionSignalRailsPanel onMissionPrompt={(prompt) => onSubmit(prompt)} />
          </div>
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
