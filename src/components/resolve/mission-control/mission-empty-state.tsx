"use client";

import { useState } from "react";
import { MissionCommandHero } from "@/components/resolve/mission-control/mission-command-hero";
import { MissionPromptField } from "@/components/resolve/mission-control/mission-prompt-field";
import { MissionHistorySidebar } from "@/components/resolve/mission-control/mission-history-sidebar";
import { MissionSignalRailsPanel } from "@/components/resolve/mission-control/mission-signal-rails-panel";
import { MissionProgressStepCard } from "@/components/resolve/mission-control/mission-progress-step-card";
import { useMissionScope } from "@/lib/mission/mission-context";
import { MissionTemplateTiles } from "@/components/resolve/mission-control/mission-template-tiles";
import { MissionIntelValuePanel } from "@/components/resolve/mission-control/mission-intel-value-panel";
import { MISSION_JOBS } from "@/lib/mission/mission-lane-copy";

export function MissionEmptyState({
  input,
  onInputChange,
  onSubmit,
  loading,
  onNewMission,
  onSelectSession,
  onSessionDeleted,
  activeSessionId,
  libraryTick,
  scopeHint,
  onAcceptScopeHint,
  onDismissScopeHint,
}: {
  input: string;
  onInputChange: (v: string) => void;
  onSubmit: (text: string) => void;
  loading?: boolean;
  onNewMission: () => void;
  onSelectSession: (session: import("@/lib/mission/toolbox/mission-library").MissionSession) => void;
  onSessionDeleted?: (sessionId: string) => void;
  activeSessionId?: string | null;
  libraryTick?: number;
  scopeHint?: string | null;
  onAcceptScopeHint?: () => void;
  onDismissScopeHint?: () => void;
}) {
  const { scope } = useMissionScope();
  const [showMore, setShowMore] = useState(false);

  const secondaryJobs = MISSION_JOBS.filter(
    (j) => j.id !== "fund" && j.id !== "simulate" && j.id !== "agent",
  );

  return (
    <div className="mission-workspace-shell flex h-[calc(100vh-3.75rem)] min-h-[560px]">
      <MissionHistorySidebar
        onNewMission={onNewMission!}
        onSelectSession={onSelectSession!}
        onSessionDeleted={onSessionDeleted}
        activeSessionId={activeSessionId}
        libraryVersion={libraryTick}
      />

      <div className="min-w-0 flex-1 overflow-y-auto px-4 py-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <MissionCommandHero onSubmit={onSubmit} />

          {scopeHint && onAcceptScopeHint && (
            <div className="mission-scope-hint">
              <p className="text-sm text-white/90">
                Continue with <span className="font-medium text-sky-200">{scope?.label}</span>?
              </p>
              <p className="mt-1 line-clamp-2 text-xs text-resolve-muted">{scopeHint}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="mission-btn mission-btn--primary" onClick={onAcceptScopeHint}>
                  Run scoped mission
                </button>
                <button type="button" className="mission-btn mission-btn--ghost" onClick={onDismissScopeHint}>
                  Dismiss
                </button>
              </div>
            </div>
          )}

          <MissionPromptField
            value={input}
            onChange={onInputChange}
            onSubmit={() => onSubmit(input.trim())}
            loading={loading}
          />

          {loading && <MissionProgressStepCard active title="Starting your mission" />}

          <MissionTemplateTiles onSubmit={onSubmit} />

          <MissionIntelValuePanel onTryExample={onSubmit} loading={loading} />

          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="text-xs text-resolve-muted transition hover:text-white"
          >
            {showMore ? "Hide" : "More"} mission types
          </button>

          {showMore && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {secondaryJobs.map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    disabled={loading}
                    onClick={() => onSubmit(job.prompt)}
                    className="mission-chip disabled:opacity-40"
                  >
                    {job.who}
                  </button>
                ))}
              </div>
              <details className="mission-panel">
                <summary className="cursor-pointer list-none px-4 py-3 text-xs text-resolve-muted marker:content-none [&::-webkit-details-marker]:hidden">
                  Full signal catalog
                </summary>
                <div className="border-t border-white/[0.06] px-3 py-3">
                  <MissionSignalRailsPanel onMissionPrompt={(prompt) => onSubmit(prompt)} />
                </div>
              </details>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
