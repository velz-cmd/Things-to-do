"use client";

import { useEffect, useState } from "react";
import { ProtocolChat } from "@/components/resolve/workspace/protocol-chat";
import { ValueNetworkPanel } from "@/components/resolve/workspace/value-network-panel";
import { WorkspaceCapitalPanel } from "@/components/resolve/workspace/workspace-capital-panel";
import { ManualAllocationPanel } from "@/components/resolve/workspace/manual-allocation-panel";
import { Panel } from "@/components/resolve/ui/panel";
import type { PolicyProposal } from "@/lib/workspace/advisors/policy-proposals";
import type { ValueConcentration } from "@/lib/workspace/advisors/concentrations";

type Snapshot = {
  concentrations: ValueConcentration[];
  policies: PolicyProposal[];
  treasuryBalanceUsd: number;
};

/** Open Capital Workspace — observe first, reason second, settle last. */
export function WorkspaceProtocol() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [policies, setPolicies] = useState<PolicyProposal[]>([]);
  const [preset, setPreset] = useState<import("@/lib/workspace/founder-presets").FounderPresetId>("balanced");

  useEffect(() => {
    void fetch("/api/workspace/ask")
      .then((r) => r.json())
      .then((d) => {
        setSnapshot({
          concentrations: d.concentrations ?? [],
          policies: d.policies ?? [],
          treasuryBalanceUsd: d.treasuryBalanceUsd ?? 0,
        });
        setPolicies(d.policies ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-10">
      <ValueNetworkPanel />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <ProtocolChat
            onPoliciesChange={setPolicies}
            initialConcentrations={snapshot?.concentrations}
          />
        </div>
        <div className="lg:col-span-3">
          <WorkspaceCapitalPanel
            loading={loading}
            concentrations={snapshot?.concentrations ?? []}
            treasuryBalanceUsd={snapshot?.treasuryBalanceUsd ?? 0}
          />
        </div>
      </div>

      <Panel variant="glass" className="p-6">
        <ManualAllocationPanel policies={policies} preset={preset} onPresetChange={setPreset} />
      </Panel>
    </div>
  );
}
