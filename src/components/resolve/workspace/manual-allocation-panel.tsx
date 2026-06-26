"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Panel } from "@/components/resolve/ui/panel";
import { FounderPriorities } from "@/components/resolve/workspace/founder-priorities";
import type { FounderPresetId } from "@/lib/workspace/founder-presets";
import type { PolicyProposal } from "@/lib/workspace/advisors/policy-proposals";
import { PolicyProposalCards } from "@/components/resolve/workspace/workspace-value-panel";

/** Manual control layer — precision for users who don't trust chat-only. */
export function ManualAllocationPanel({
  policies,
  preset,
  onPresetChange,
}: {
  policies: PolicyProposal[];
  preset: FounderPresetId;
  onPresetChange: (id: FounderPresetId) => void;
}) {
  const [selectedPolicy, setSelectedPolicy] = useState<string | undefined>();
  const [customOpen, setCustomOpen] = useState(false);

  return (
    <details className="group rounded-xl border border-resolve-border/60 bg-resolve-raised/10 open:border-resolve-border">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 marker:content-none [&::-webkit-details-marker]:hidden">
        <SlidersHorizontal className="h-4 w-4 text-resolve-muted group-open:text-white" />
        <div>
          <p className="text-sm font-medium text-resolve-muted group-open:text-white">
            Manual control
          </p>
          <p className="text-xs text-resolve-muted-dim">
            Custom percentages · policies · treasury · batch distribution
          </p>
        </div>
      </summary>
      <div className="space-y-6 border-t border-resolve-border/60 px-5 pb-5 pt-4">
        <PolicyProposalCards
          policies={policies}
          selectedId={selectedPolicy}
          onSelect={(id) => {
            setSelectedPolicy(id);
            if (id !== "custom" && policies.some((p) => p.id === id)) {
              onPresetChange(id as FounderPresetId);
            }
            if (id === "custom") setCustomOpen(true);
          }}
        />

        {(customOpen || selectedPolicy === "custom") && (
          <Panel className="p-4">
            <p className="text-sm font-medium text-white">Custom allocation weights</p>
            <p className="mt-1 text-xs text-resolve-muted">
              Adjust intent weights for GitHub analysis and contributor scoring.
            </p>
            <div className="mt-4">
              <FounderPriorities value={preset} onChange={onPresetChange} />
            </div>
          </Panel>
        )}
      </div>
    </details>
  );
}
