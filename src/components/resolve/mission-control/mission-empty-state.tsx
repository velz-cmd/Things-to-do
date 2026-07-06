"use client";

import { MissionCommandHero } from "@/components/resolve/mission-control/mission-command-hero";
import { MissionPromptField } from "@/components/resolve/mission-control/mission-prompt-field";
import { MissionHistorySidebar } from "@/components/resolve/mission-control/mission-history-sidebar";
import { MissionProgressStepCard } from "@/components/resolve/mission-control/mission-progress-step-card";
import { MissionCreatorValuePanel } from "@/components/resolve/mission-control/mission-creator-value-panel";
import { MissionFunderToolsPanel } from "@/components/resolve/mission-control/mission-funder-tools-panel";
import { useMissionScope } from "@/lib/mission/mission-context";

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

          {loading && <MissionProgressStepCard active title="Working on your question" />}

          <MissionCreatorValuePanel onTryPrompt={onSubmit} loading={loading} />

          <MissionFunderToolsPanel onSubmit={onSubmit} loading={loading} />
        </div>
      </div>
    </div>
  );
}
