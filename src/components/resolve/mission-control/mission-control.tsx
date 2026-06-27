"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { ProtocolChat } from "@/components/resolve/workspace/protocol-chat";
import { WorkspaceContextFeed } from "@/components/resolve/workspace/workspace-context-feed";
import { WorkspaceManualView } from "@/components/resolve/workspace/workspace-manual-view";
import { ManualAllocationPanel } from "@/components/resolve/workspace/manual-allocation-panel";
import { IntelligenceBriefing } from "@/components/resolve/intelligence/intelligence-briefing";
import { useMissionScope } from "@/lib/mission/mission-context";
import type { PolicyProposal } from "@/lib/workspace/advisors/policy-proposals";
import type { OsQuestionAnswer } from "@/lib/workspace/economic-os";
import type { ValueConcentration } from "@/lib/workspace/advisors/concentrations";

/**
 * Mission Control — not a workspace.
 * Observe → Understand → Decide → Execute → Verify
 * Center: economic reasoning engine. Right: live context. Top: intelligence.
 */
export function MissionControl() {
  const { scope, enterMission } = useMissionScope();
  const [missionInput, setMissionInput] = useState("");
  const [policies, setPolicies] = useState<PolicyProposal[]>([]);
  const [sixQuestions, setSixQuestions] = useState<OsQuestionAnswer[]>([]);
  const [concentrations, setConcentrations] = useState<ValueConcentration[]>([]);
  const [showPolicies, setShowPolicies] = useState(false);
  const [preset, setPreset] = useState<import("@/lib/workspace/founder-presets").FounderPresetId>("balanced");

  useEffect(() => {
    void fetch("/api/workspace/os")
      .then((r) => r.json())
      .then((d) => {
        setSixQuestions(d.sixQuestions ?? []);
        setConcentrations(d.concentrations ?? []);
        setPolicies(d.policies ?? []);
      });
  }, []);

  return (
    <div className="flex h-[calc(100vh-3.75rem)] min-h-[640px] flex-col overflow-hidden">
      <div className="shrink-0 border-b border-resolve-border px-4 py-4 lg:px-8">
        <div className="mx-auto max-w-[1400px]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-accent">
            Mission control
          </p>
          <h1 className="mt-1 text-lg font-semibold text-white">What matters right now?</h1>
          <form
            className="mt-3 flex max-w-xl gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              enterMission(missionInput);
            }}
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-resolve-muted" />
              <input
                value={missionInput}
                onChange={(e) => setMissionInput(e.target.value)}
                placeholder="I want to fund React · owner/repo · Where is value leaking?"
                className="w-full rounded-lg border border-resolve-border bg-resolve-bg-deep/60 py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-resolve-muted-dim focus:border-resolve-accent/50 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-resolve-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
            >
              Enter mission
            </button>
          </form>
          {scope && (
            <p className="mt-2 text-xs text-resolve-muted">
              Reasoning across <span className="text-white">{scope.label}</span> — chat, evidence,
              treasury, and settlement unified.
            </p>
          )}
          <div className="mt-4 hidden lg:block">
            <IntelligenceBriefing compact />
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-48 shrink-0 flex-col border-r border-resolve-border bg-resolve-bg-deep/20 py-4 lg:flex">
          <p className="px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-resolve-muted-dim">
            Understand
          </p>
          <button
            type="button"
            onClick={() => setShowPolicies(false)}
            className={`mx-2 mt-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition ${
              !showPolicies
                ? "bg-resolve-accent/15 text-white"
                : "text-resolve-muted hover:bg-resolve-hover/30 hover:text-white"
            }`}
          >
            Reason
          </button>
          <button
            type="button"
            onClick={() => setShowPolicies(true)}
            className={`mx-2 mt-1 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition ${
              showPolicies
                ? "bg-resolve-accent/15 text-white"
                : "text-resolve-muted hover:bg-resolve-hover/30 hover:text-white"
            }`}
          >
            Policies
          </button>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {showPolicies ? (
            <div className="flex-1 overflow-y-auto p-6">
              <WorkspaceManualView answers={sixQuestions} />
              <div className="mt-8">
                <ManualAllocationPanel
                  policies={policies}
                  preset={preset}
                  onPresetChange={setPreset}
                />
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col p-4 md:p-6">
              <ProtocolChat
                onPoliciesChange={setPolicies}
                initialConcentrations={concentrations}
                variant="engine"
                fullHeight
                missionLabel={scope?.label}
              />
            </div>
          )}
        </div>

        <WorkspaceContextFeed className="hidden w-72 xl:flex" missionLabel={scope?.label} />
      </div>
    </div>
  );
}
