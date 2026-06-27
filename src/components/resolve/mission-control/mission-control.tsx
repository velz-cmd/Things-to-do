"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ProtocolChat } from "@/components/resolve/workspace/protocol-chat";
import { WorkspaceContextFeed } from "@/components/resolve/workspace/workspace-context-feed";
import { WorkspaceManualView } from "@/components/resolve/workspace/workspace-manual-view";
import { ManualAllocationPanel } from "@/components/resolve/workspace/manual-allocation-panel";
import { useMissionScope } from "@/lib/mission/mission-context";
import type { PolicyProposal } from "@/lib/workspace/advisors/policy-proposals";
import type { OsQuestionAnswer } from "@/lib/workspace/economic-os";
import type { ValueConcentration } from "@/lib/workspace/advisors/concentrations";

/**
 * Mission — one surface like Cursor / Circle Agent.
 * Chat + live feed. No tab rotation. Fund & policies are actions, not pages.
 */
export function MissionControl() {
  const { scope } = useMissionScope();
  const searchParams = useSearchParams();
  const panel = searchParams.get("panel");
  const [policies, setPolicies] = useState<PolicyProposal[]>([]);
  const [sixQuestions, setSixQuestions] = useState<OsQuestionAnswer[]>([]);
  const [concentrations, setConcentrations] = useState<ValueConcentration[]>([]);
  const [preset, setPreset] = useState<import("@/lib/workspace/founder-presets").FounderPresetId>("balanced");
  const showPolicies = panel === "policies";

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
      <div className="flex min-w-0 flex-1 flex-col">
        {showPolicies ? (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="mb-6 flex items-center justify-between">
              <h1 className="text-lg font-semibold text-white">Allocation policies</h1>
              <Link href="/control" className="text-xs text-resolve-accent hover:underline">
                ← Back to mission
              </Link>
            </div>
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
      </div>

      <WorkspaceContextFeed className="hidden w-80 border-l border-resolve-border xl:flex" missionLabel={scope?.label} />
    </div>
  );
}
