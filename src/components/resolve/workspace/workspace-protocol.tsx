"use client";

import { useEffect, useState } from "react";
import { ProtocolChat } from "@/components/resolve/workspace/protocol-chat";
import { WorkspaceValuePanel } from "@/components/resolve/workspace/workspace-value-panel";
import { ManualAllocationPanel } from "@/components/resolve/workspace/manual-allocation-panel";
import type { PolicyProposal } from "@/lib/workspace/advisors/policy-proposals";
import type { OpportunityCard } from "@/lib/workspace/advisors/opportunity-cards";
import type { FounderPresetId } from "@/lib/workspace/founder-presets";

type Snapshot = {
  valueFlow: {
    recognizedUsd: number;
    claimableUsd: number;
    settledUsd: number;
    participantCount: number;
  } | null;
  opportunities: OpportunityCard[];
  policies: PolicyProposal[];
};

/** AI command center — chat + value intelligence + manual policies. */
export function WorkspaceProtocol() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [policies, setPolicies] = useState<PolicyProposal[]>([]);
  const [preset, setPreset] = useState<FounderPresetId>("balanced");

  useEffect(() => {
    void fetch("/api/workspace/ask")
      .then((r) => r.json())
      .then((d) => {
        setSnapshot({
          valueFlow: d.valueFlow ?? null,
          opportunities: d.opportunities ?? [],
          policies: d.policies ?? [],
        });
        setPolicies(d.policies ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <ProtocolChat onPoliciesChange={setPolicies} />
        </div>
        <div className="lg:col-span-3">
          <WorkspaceValuePanel
            loading={loading}
            valueFlow={snapshot?.valueFlow ?? null}
            opportunities={snapshot?.opportunities ?? []}
          />
        </div>
      </div>

      <section className="rounded-xl border border-resolve-border/60 bg-resolve-raised/20 p-5">
        <ManualAllocationPanel
          policies={policies}
          preset={preset}
          onPresetChange={setPreset}
        />
      </section>
    </div>
  );
}
