"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { MessageSquare, SlidersHorizontal } from "lucide-react";
import { ProtocolChat } from "@/components/resolve/workspace/protocol-chat";
import { EconomicBriefing } from "@/components/resolve/workspace/economic-briefing";
import { WorkspaceManualView } from "@/components/resolve/workspace/workspace-manual-view";
import { SensorStrip } from "@/components/resolve/workspace/sensor-strip";
import { ManualAllocationPanel } from "@/components/resolve/workspace/manual-allocation-panel";
import type { PolicyProposal } from "@/lib/workspace/advisors/policy-proposals";
import type { OsQuestionAnswer } from "@/lib/workspace/economic-os";
import type { ValueConcentration } from "@/lib/workspace/advisors/concentrations";

type OsPayload = {
  headline: string;
  sixQuestions: OsQuestionAnswer[];
  concentrations: ValueConcentration[];
  policies: PolicyProposal[];
};

type InterfaceMode = "reason" | "manual";

/**
 * Universal Settlement Engine — one workspace, two interfaces.
 * Chat and manual views share the same value graph and authorization ledger.
 */
export function WorkspaceOS() {
  const [data, setData] = useState<OsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<InterfaceMode>("reason");
  const [policies, setPolicies] = useState<PolicyProposal[]>([]);
  const [preset, setPreset] = useState<import("@/lib/workspace/founder-presets").FounderPresetId>("balanced");

  useEffect(() => {
    void fetch("/api/workspace/os")
      .then((r) => r.json())
      .then((d) => {
        setData({
          headline: d.headline ?? "",
          sixQuestions: d.sixQuestions ?? [],
          concentrations: d.concentrations ?? [],
          policies: d.policies ?? [],
        });
        setPolicies(d.policies ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <EconomicBriefing
        headline={data?.headline ?? "Observing open ecosystems for value flow."}
        answers={data?.sixQuestions ?? []}
        loading={loading}
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-resolve-muted">
          Same engine · two interfaces — converse or control directly.
        </p>
        <div className="flex rounded-2xl resolve-glass-subtle p-1 ring-1 ring-resolve-border">
          <button
            type="button"
            onClick={() => setMode("reason")}
            className={clsx(
              "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition",
              mode === "reason"
                ? "resolve-accent-gradient text-white shadow-resolve-glow"
                : "text-resolve-muted hover:text-white",
            )}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Reason
          </button>
          <button
            type="button"
            onClick={() => setMode("manual")}
            className={clsx(
              "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition",
              mode === "manual"
                ? "resolve-accent-gradient text-white shadow-resolve-glow"
                : "text-resolve-muted hover:text-white",
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Manual
          </button>
        </div>
      </div>

      {mode === "reason" ? (
        <div className="max-w-3xl">
          <ProtocolChat
            onPoliciesChange={setPolicies}
            initialConcentrations={data?.concentrations}
            variant="engine"
          />
        </div>
      ) : (
        <div className="space-y-8">
          <WorkspaceManualView answers={data?.sixQuestions ?? []} />
          <ManualAllocationPanel policies={policies} preset={preset} onPresetChange={setPreset} />
        </div>
      )}

      <SensorStrip />
    </div>
  );
}
