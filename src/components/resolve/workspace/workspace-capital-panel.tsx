"use client";

import Link from "next/link";
import { Landmark, Shield, TrendingUp, AlertTriangle } from "lucide-react";
import { BlueGlowCard } from "@/components/resolve/ui/blue-glow-card";
import { Money } from "@/components/resolve/ui/money";
import type { ValueConcentration } from "@/lib/workspace/advisors/concentrations";

/** Capital allocation surface — treasury, concentrations, risks. Settlement is last. */
export function WorkspaceCapitalPanel({
  concentrations,
  treasuryBalanceUsd,
  loading,
}: {
  concentrations: ValueConcentration[];
  treasuryBalanceUsd: number;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <BlueGlowCard className="p-10 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-resolve-border border-t-resolve-accent" />
        <p className="mt-4 text-sm text-resolve-muted">Loading capital intelligence…</p>
      </BlueGlowCard>
    );
  }

  return (
    <div className="space-y-5">
      <BlueGlowCard className="p-5" grid={false}>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl resolve-accent-gradient shadow-resolve-glow">
            <Landmark className="h-4 w-4 text-white" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-resolve-muted-dim">
              Capital
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
              {treasuryBalanceUsd > 0 ? (
                <Money amount={treasuryBalanceUsd} size="sm" />
              ) : (
                <span className="text-resolve-muted">No treasury funded</span>
              )}
            </p>
            <p className="mt-1 text-xs text-resolve-muted">
              Allocation recommendations below — nothing settles until you approve.
            </p>
            <Link
              href="/payments"
              className="mt-3 inline-block text-xs font-semibold text-resolve-accent-bright hover:underline"
            >
              Open treasury controls →
            </Link>
          </div>
        </div>
      </BlueGlowCard>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5 text-resolve-accent" />
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-resolve-muted">
            Value concentrations
          </h3>
        </div>
        {concentrations.length === 0 ? (
          <p className="text-sm text-resolve-muted">
            Concentrations appear as ecosystems generate real signals. Connect sensors in{" "}
            <Link href="/activity" className="text-resolve-accent hover:underline">
              Activity
            </Link>
            .
          </p>
        ) : (
          <ul className="space-y-2">
            {concentrations.map((c) => (
              <li key={c.id}>
                <BlueGlowCard className="p-4" grid={false} hover>
                  <p className="text-sm font-medium text-white">{c.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-resolve-muted">{c.detail}</p>
                  {c.domain && (
                    <span className="mt-2 inline-block rounded-full bg-resolve-accent/10 px-2 py-0.5 text-[10px] text-resolve-accent">
                      {c.domain}
                    </span>
                  )}
                </BlueGlowCard>
              </li>
            ))}
          </ul>
        )}
      </section>

      <BlueGlowCard className="border border-amber-400/15 p-4" grid={false}>
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <div>
            <p className="text-xs font-semibold text-amber-100">Trust model</p>
            <p className="mt-1 text-xs leading-relaxed text-resolve-muted">
              Every recommendation includes evidence from live connectors. Confidence, risk, and
              impact are surfaced before capital moves.{" "}
              <span className="text-white/90">Approve · modify · reject</span> — never auto-execute.
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-[10px] text-resolve-muted-dim">
          <Shield className="h-3 w-3" />
          Settlement is the last step — discovery and allocation come first.
        </div>
      </BlueGlowCard>
    </div>
  );
}
