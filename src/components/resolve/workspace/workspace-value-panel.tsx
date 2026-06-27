"use client";

import Link from "next/link";
import clsx from "clsx";
import { Activity, Zap, Search, Wallet, CheckCircle } from "lucide-react";
import { Panel } from "@/components/resolve/ui/panel";
import { MetricCard } from "@/components/resolve/ui/metric-card";
import { SectionHeader } from "@/components/resolve/ui/section-header";
import { Money } from "@/components/resolve/ui/money";
import type { OpportunityCard } from "@/lib/workspace/advisors/opportunity-cards";

type ValueFlow = {
  recognizedUsd: number;
  claimableUsd: number;
  settledUsd: number;
  participantCount: number;
};

export function WorkspaceValuePanel({
  valueFlow,
  opportunities,
  loading,
}: {
  valueFlow: ValueFlow | null;
  opportunities: OpportunityCard[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <Panel variant="glass" className="p-10 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-resolve-border border-t-resolve-accent" />
        <p className="mt-4 text-sm text-resolve-muted">Loading live value graph…</p>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <section>
        <SectionHeader
          title="Live value flow"
          description="Recognized, claimable, and settled across open ecosystems"
          icon={Activity}
        />
        {valueFlow ?
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <MetricCard
              label="Recognized"
              value={<Money amount={valueFlow.recognizedUsd} size="sm" />}
              hint="Across open ecosystems"
              tone="accent"
            />
            <MetricCard
              label="Claimable"
              value={<Money amount={valueFlow.claimableUsd} size="sm" />}
              hint={`${valueFlow.participantCount} participant${valueFlow.participantCount === 1 ? "" : "s"}`}
              tone="success"
              live
            />
            <MetricCard
              label="Settled"
              value={<Money amount={valueFlow.settledUsd} size="sm" />}
              hint="Arc batches"
              tone="blue"
            />
          </div>
        : <Panel variant="flat" className="mt-4 p-5">
            <p className="text-sm text-resolve-muted">
              Value will appear as connectors discover activity across open ecosystems.
            </p>
            <Link href="/activity" className="mt-2 inline-block text-xs text-resolve-accent hover:underline">
              View activity →
            </Link>
          </Panel>
        }
      </section>

      {opportunities.length > 0 && (
        <section>
          <SectionHeader
            title="Opportunities"
            description="Evidence-backed projects worth funding"
            icon={Zap}
          />
          <ul className="mt-4 space-y-3">
            {opportunities.map((o) => (
              <li key={o.id}>
                <Panel variant="glass" className="p-4 transition hover:border-resolve-accent/20" padding={false}>
                  <div className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-medium text-white">{o.title}</p>
                      <span
                        className={clsx(
                          "rounded-full px-2.5 py-0.5 text-[10px] font-semibold",
                          o.badgeTone === "high" && "bg-emerald-500/15 text-emerald-300",
                          o.badgeTone === "claimable" && "bg-sky-500/15 text-sky-300",
                          o.badgeTone === "medium" && "bg-amber-500/15 text-amber-300",
                        )}
                      >
                        {o.badge}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-resolve-muted">{o.subtitle}</p>
                    <div className="mt-3 flex gap-4 text-xs text-resolve-muted">
                      <span>
                        {o.statA.label}: <span className="text-white">{o.statA.value}</span>
                      </span>
                      <span>
                        {o.statB.label}: <span className="text-white">{o.statB.value}</span>
                      </span>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Link
                        href={o.primaryAction.href}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-resolve-border-strong bg-resolve-raised/80 px-3 py-1.5 text-xs font-medium text-white transition hover:border-resolve-accent/40"
                      >
                        <Wallet className="h-3 w-3" />
                        {o.primaryAction.label}
                      </Link>
                      <Link
                        href={o.secondaryAction.href}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-resolve-border/60 px-3 py-1.5 text-xs text-resolve-muted transition hover:text-white"
                      >
                        <Search className="h-3 w-3" />
                        {o.secondaryAction.label}
                      </Link>
                    </div>
                  </div>
                </Panel>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function PolicyProposalCards({
  policies,
  selectedId,
  onSelect,
}: {
  policies: import("@/lib/workspace/advisors/policy-proposals").PolicyProposal[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  if (!policies.length) return null;

  return (
    <section>
      <SectionHeader
        title="Allocation policies"
        description="Suggest only — approve, modify, or build custom. Nothing executes until you confirm."
      />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {policies.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p.id)}
            className={clsx(
              "rounded-resolve-lg border p-4 text-left transition",
              selectedId === p.id
                ? "border-resolve-accent/50 bg-resolve-accent/10 resolve-card-glow-accent"
                : "border-resolve-border/60 bg-resolve-raised/30 hover:border-resolve-border-strong",
            )}
          >
            <p className="text-sm font-medium text-white">
              {p.emoji} {p.label}
            </p>
            <p className="mt-1 text-xs text-resolve-muted">{p.description}</p>
            {p.splits.length > 0 && (
              <p className="mt-2 text-[10px] text-resolve-muted-dim">
                {p.splits.map((s) => `${s.label} ${s.percent}%`).join(" · ")}
              </p>
            )}
          </button>
        ))}
      </div>
      <Link
        href="/payments"
        className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-resolve-accent hover:underline"
      >
        <CheckCircle className="h-3 w-3" />
        Open treasury controls
      </Link>
    </section>
  );
}
