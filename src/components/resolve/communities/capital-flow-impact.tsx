"use client";

import clsx from "clsx";
import { ArrowRight, CircleDollarSign, Headphones, Music2, Radio, Users } from "lucide-react";
import { BlueGlowCard } from "@/components/resolve/ui/blue-glow-card";
import { Money } from "@/components/resolve/ui/money";
import type { CommunityImpactChain } from "@/lib/communities/types";

const STAGE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  capital: CircleDollarSign,
  program: Radio,
  artists: Users,
  plays: Headphones,
  impact: Music2,
};

/** Impact chain — $ → program → artists → plays → estimated reach */
export function CapitalFlowImpact({
  impact,
  className,
}: {
  impact: CommunityImpactChain;
  className?: string;
}) {
  return (
    <BlueGlowCard className={clsx("overflow-hidden", className)} padding={false}>
      <div className="border-b border-white/[0.06] px-6 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-accent">
          Capital flow
        </p>
        <h3 className="mt-1 text-lg font-semibold text-white">Impact chain</h3>
        <p className="mt-1 text-xs text-resolve-muted">
          Money → program → work → ecosystem benefit — not wallet to wallet
        </p>
      </div>

      <div className="relative px-4 py-6 md:px-6">
        <div
          aria-hidden
          className="pointer-events-none absolute left-8 right-8 top-1/2 hidden h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-resolve-accent/40 to-transparent md:block"
        />

        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {impact.stages.map((stage, idx) => {
            const Icon = STAGE_ICONS[stage.id] ?? CircleDollarSign;
            return (
              <li
                key={stage.id}
                className="relative animate-resolve-enter"
                style={{ animationDelay: `${idx * 80}ms` }}
              >
                <div className="group rounded-xl border border-white/[0.08] bg-[#0a0f18]/80 p-4 transition-colors hover:border-resolve-accent/30">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-resolve-accent/10">
                      <Icon className="h-4 w-4 text-resolve-accent" />
                    </div>
                    {idx < impact.stages.length - 1 && (
                      <ArrowRight className="hidden h-3.5 w-3.5 text-resolve-muted-dim lg:block" />
                    )}
                  </div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-resolve-muted">
                    {stage.label}
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-white">{stage.value}</p>
                  {stage.sublabel && (
                    <p className="mt-0.5 text-[11px] text-resolve-muted-dim">{stage.sublabel}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        <div className="mt-6 flex flex-wrap items-center gap-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-xs">
          <span className="text-resolve-muted">Pipeline</span>
          <span className="text-emerald-300">
            <Money amount={impact.authorizedUsd} size="sm" className="inline" /> owed
          </span>
          <span className="text-resolve-muted-dim">→</span>
          <span className="text-white">
            <Money amount={impact.settledUsd} size="sm" className="inline" /> settled
          </span>
          <span className="text-resolve-muted-dim">→</span>
          <span className="text-resolve-accent">
            ~{impact.estimatedListeners.toLocaleString()} est. listener reach
          </span>
        </div>
      </div>
    </BlueGlowCard>
  );
}
