"use client";

import { useEffect, useState } from "react";
import { ProtocolChat } from "@/components/resolve/workspace/protocol-chat";
import { WorkspaceSidebar } from "@/components/resolve/workspace/workspace-sidebar";
import { WorkspaceContextFeed } from "@/components/resolve/workspace/workspace-context-feed";
import { WorkspaceManualView } from "@/components/resolve/workspace/workspace-manual-view";
import { ManualAllocationPanel } from "@/components/resolve/workspace/manual-allocation-panel";
import type { PolicyProposal } from "@/lib/workspace/advisors/policy-proposals";
import type { OsQuestionAnswer } from "@/lib/workspace/economic-os";
import type { ValueConcentration } from "@/lib/workspace/advisors/concentrations";

/**
 * Cursor layout: sidebar | command (70%) | live context feed.
 * No card stacks. Whitespace is premium.
 */
export function WorkspaceOS() {
  const [policies, setPolicies] = useState<PolicyProposal[]>([]);
  const [sixQuestions, setSixQuestions] = useState<OsQuestionAnswer[]>([]);
  const [concentrations, setConcentrations] = useState<ValueConcentration[]>([]);
  const [showManual, setShowManual] = useState(false);
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
    <div className="flex h-[calc(100vh-3.75rem)] min-h-[640px] overflow-hidden">
      <WorkspaceSidebar onManual={() => setShowManual((v) => !v)} />

      <div className="flex min-w-0 flex-1 flex-col">
        {showManual ? (
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
            />
          </div>
        )}
      </div>

      <WorkspaceContextFeed className="hidden w-72 xl:flex" />
    </div>
  );
}
