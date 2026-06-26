"use client";

import { useEffect, useState } from "react";
import { LayoutGrid } from "lucide-react";
import { ProtocolChat } from "@/components/resolve/workspace/protocol-chat";
import { WorkspaceValuePanel } from "@/components/resolve/workspace/workspace-value-panel";
import { WorkspaceOsDashboard } from "@/components/resolve/workspace/workspace-os-dashboard";
import type { PolicyProposal } from "@/lib/workspace/advisors/policy-proposals";
import type { OpportunityCard } from "@/lib/workspace/advisors/opportunity-cards";

const PILLS = [
  { label: "Open ecosystems", tone: "sky" },
  { label: "Live value graph", tone: "emerald" },
  { label: "AI reasoning", tone: "violet" },
  { label: "Real settlement", tone: "amber" },
] as const;

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

/** Hybrid protocol workspace — open chat + manual control, same underlying system. */
export function WorkspaceProtocol({
  manualSlot,
}: {
  manualSlot?: (policies: PolicyProposal[]) => React.ReactNode;
}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [policies, setPolicies] = useState<PolicyProposal[]>([]);

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
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-5 w-5 text-resolve-accent" />
          <h1 className="text-xl font-semibold text-white md:text-2xl">Resolve Workspace</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {PILLS.map((p) => (
            <span
              key={p.label}
              className="rounded-full border border-resolve-border/60 bg-resolve-raised/40 px-2.5 py-1 text-[10px] font-medium text-resolve-muted"
            >
              {p.label}
            </span>
          ))}
        </div>
        <p className="max-w-2xl text-sm text-resolve-muted">
          A participant in the global value network — not a GitHub user, not a musician, not a DAO
          member. Ask anything. Act manually. Approve everything.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-5 lg:gap-6">
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

      {manualSlot?.(policies)}

      <details className="group rounded-xl border border-resolve-border/40">
        <summary className="cursor-pointer px-4 py-3 text-xs text-resolve-muted hover:text-white">
          Activity & connected sources
        </summary>
        <div className="border-t border-resolve-border/40 p-2">
          <WorkspaceOsDashboard compact />
        </div>
      </details>
    </div>
  );
}
