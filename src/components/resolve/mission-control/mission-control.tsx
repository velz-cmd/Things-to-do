"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { ProtocolChat } from "@/components/resolve/workspace/protocol-chat";
import { WorkspaceContextFeed } from "@/components/resolve/workspace/workspace-context-feed";
import { WorkspaceManualView } from "@/components/resolve/workspace/workspace-manual-view";
import { ManualAllocationPanel } from "@/components/resolve/workspace/manual-allocation-panel";
import { MISSION_TOOLS } from "@/components/resolve/layout/nav";
import { useMissionScope } from "@/lib/mission/mission-context";
import type { PolicyProposal } from "@/lib/workspace/advisors/policy-proposals";
import type { OsQuestionAnswer } from "@/lib/workspace/economic-os";
import type { ValueConcentration } from "@/lib/workspace/advisors/concentrations";

type MissionPanel = (typeof MISSION_TOOLS)[number]["id"];

/**
 * Mission OS — sidebar tools | AI reasoning | live panel.
 * @see docs/INFORMATION-ARCHITECTURE.md
 */
export function MissionControl() {
  const { scope } = useMissionScope();
  const searchParams = useSearchParams();
  const panelParam = searchParams.get("panel") as MissionPanel | null;
  const [panel, setPanel] = useState<MissionPanel>(panelParam === "policies" ? "policies" : "command");
  const [policies, setPolicies] = useState<PolicyProposal[]>([]);
  const [sixQuestions, setSixQuestions] = useState<OsQuestionAnswer[]>([]);
  const [concentrations, setConcentrations] = useState<ValueConcentration[]>([]);
  const [preset, setPreset] = useState<import("@/lib/workspace/founder-presets").FounderPresetId>("balanced");

  useEffect(() => {
    if (panelParam === "policies") setPanel("policies");
  }, [panelParam]);

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
    <div className="flex h-[calc(100vh-3.75rem)] min-h-[560px] overflow-hidden">
      <aside className="hidden w-44 shrink-0 flex-col border-r border-resolve-border bg-resolve-bg-deep/20 py-4 lg:flex">
        <p className="px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-resolve-muted-dim">
          Mission
        </p>
        <ul className="mt-2 space-y-0.5 px-2">
          {MISSION_TOOLS.map((tool) => (
            <li key={tool.id}>
              <button
                type="button"
                title={tool.question}
                onClick={() => setPanel(tool.id)}
                className={clsx(
                  "w-full rounded-lg px-3 py-2 text-left text-[13px] font-medium transition",
                  panel === tool.id
                    ? "bg-resolve-accent/15 text-white"
                    : "text-resolve-muted hover:bg-resolve-hover/30 hover:text-white",
                )}
              >
                {tool.label}
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-auto border-t border-resolve-border px-4 pt-4 text-[10px] text-resolve-muted-dim">
          {scope ? (
            <p>
              Scope: <span className="text-white">{scope.label}</span>
            </p>
          ) : (
            <p>No mission scoped</p>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {panel === "command" && (
          <div className="flex min-h-0 flex-1 flex-col p-3 md:p-5">
            <ProtocolChat
              onPoliciesChange={setPolicies}
              initialConcentrations={concentrations}
              variant="engine"
              fullHeight
              missionLabel={scope?.label}
            />
          </div>
        )}

        {panel === "policies" && (
          <div className="flex-1 overflow-y-auto p-6">
            <WorkspaceManualView answers={sixQuestions} />
            <div className="mt-8">
              <ManualAllocationPanel policies={policies} preset={preset} onPresetChange={setPreset} />
            </div>
          </div>
        )}

        {panel !== "command" && panel !== "policies" && (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <p className="text-sm font-medium text-white">
              {MISSION_TOOLS.find((t) => t.id === panel)?.label}
            </p>
            <p className="mt-2 max-w-sm text-sm text-resolve-muted">
              {MISSION_TOOLS.find((t) => t.id === panel)?.question} — ships with the value graph
              engine (Layer 4).
            </p>
            <button
              type="button"
              onClick={() => setPanel("command")}
              className="mt-6 text-sm text-resolve-accent hover:underline"
            >
              ← Back to Command
            </button>
          </div>
        )}
      </div>

      <WorkspaceContextFeed className="hidden w-80 border-l border-resolve-border xl:flex" missionLabel={scope?.label} />
    </div>
  );
}
