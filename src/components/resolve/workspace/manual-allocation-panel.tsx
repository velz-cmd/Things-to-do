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
    <div className="space-y-6">
      <div className="flex items-start gap-2">
        <SlidersHorizontal className="mt-0.5 h-4 w-4 text-resolve-accent" />
        <div>
          <p className="text-sm font-medium text-white">Manual control</p>
          <p className="text-xs text-resolve-muted">
            Policies, custom weights, and treasury routing — always available alongside chat.
          </p>
        </div>
      </div>

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
  );
}
