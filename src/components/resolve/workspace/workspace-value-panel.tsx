"use client";

import Link from "next/link";
import clsx from "clsx";
import { Activity, Zap, Search, Wallet, CheckCircle } from "lucide-react";
import { Panel } from "@/components/resolve/ui/panel";
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
      <Panel className="p-8 text-center text-sm text-resolve-muted">
        Loading live value graph…
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      <section>
        <div className="mb-2 flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-white">Live value flow</h2>
        </div>
        {valueFlow ? (
          <div className="grid gap-2 sm:grid-cols-3">
            <FlowCard
              label="Recognized"
              amount={valueFlow.recognizedUsd}
              hint="Across open ecosystems"
            />
            <FlowCard
              label="Claimable"
              amount={valueFlow.claimableUsd}
              hint={`${valueFlow.participantCount} participant${valueFlow.participantCount === 1 ? "" : "s"}`}
              accent
            />
            <FlowCard label="Settled" amount={valueFlow.settledUsd} hint="Arc batches" />
          </div>
        ) : (
          <p className="text-sm text-resolve-muted">
            Value will appear as connectors discover activity across open ecosystems.
          </p>
        )}
      </section>

      {opportunities.length > 0 && (
        <section>
          <div className="mb-2 flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-white">Opportunities</h2>
          </div>
          <ul className="space-y-2">
            {opportunities.map((o) => (
              <li key={o.id}>
                <Panel className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-medium text-white">{o.title}</p>
                    <span
                      className={clsx(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium",
                        o.badgeTone === "high" && "bg-emerald-500/15 text-emerald-300",
                        o.badgeTone === "claimable" && "bg-sky-500/15 text-sky-300",
                        o.badgeTone === "medium" && "bg-amber-500/15 text-amber-300",
                      )}
                    >
                      {o.badge}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-resolve-muted">{o.subtitle}</p>
                  <div className="mt-2 flex gap-4 text-xs text-resolve-muted">
                    <span>
                      {o.statA.label}: <span className="text-white">{o.statA.value}</span>
                    </span>
                    <span>
                      {o.statB.label}: <span className="text-white">{o.statB.value}</span>
                    </span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Link
                      href={o.primaryAction.href}
                      className="inline-flex items-center gap-1 rounded-md border border-resolve-border px-3 py-1.5 text-xs text-white hover:border-resolve-accent/40"
                    >
                      <Wallet className="h-3 w-3" />
                      {o.primaryAction.label}
                    </Link>
                    <Link
                      href={o.secondaryAction.href}
                      className="inline-flex items-center gap-1 rounded-md border border-resolve-border/60 px-3 py-1.5 text-xs text-resolve-muted hover:text-white"
                    >
                      <Search className="h-3 w-3" />
                      {o.secondaryAction.label}
                    </Link>
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

function FlowCard({
  label,
  amount,
  hint,
  accent,
}: {
  label: string;
  amount: number;
  hint: string;
  accent?: boolean;
}) {
  return (
    <Panel className="p-3">
      <p className="text-[10px] uppercase text-resolve-muted">{label}</p>
      <p className={clsx("mt-1 text-lg font-semibold", accent ? "text-emerald-300" : "text-white")}>
        <Money amount={amount} size="sm" />
      </p>
      <p className="mt-0.5 text-[10px] text-resolve-muted-dim">{hint}</p>
    </Panel>
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
      <h2 className="text-[10px] font-medium uppercase tracking-[0.15em] text-resolve-muted">
        Allocation policies — suggest only
      </h2>
      <p className="mt-1 text-xs text-resolve-muted">
        Approve, modify percentages, or build custom. Nothing executes until you confirm.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {policies.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p.id)}
            className={clsx(
              "rounded-xl border p-4 text-left transition",
              selectedId === p.id
                ? "border-resolve-accent/50 bg-resolve-accent/10"
                : "border-resolve-border/60 bg-resolve-raised/20 hover:border-resolve-border",
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
        className="mt-3 inline-flex items-center gap-1 text-xs text-resolve-accent hover:underline"
      >
        <CheckCircle className="h-3 w-3" />
        Open manual treasury controls
      </Link>
    </section>
  );
}
