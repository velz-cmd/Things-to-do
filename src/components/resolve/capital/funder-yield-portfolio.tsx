"use client";

import { useEffect, useState } from "react";
import { Loader2, TrendingUp } from "lucide-react";
import { BlueGlowCard } from "@/components/resolve/ui/blue-glow-card";
import { Money } from "@/components/resolve/ui/money";
import { CAPITAL_YIELD_COPY } from "@/lib/capital/copy";
import type { FunderStakeYield } from "@/lib/capital/community-yield";

type PortfolioResponse = {
  stakes: FunderStakeYield[];
  summary: {
    totalPrincipalUsd: number;
    totalAttributedImpactUsd: number;
    portfolioMultiplier: number;
    targetsMet: number;
    stakeCount: number;
  };
};

export function FunderYieldPortfolio() {
  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/capital/yield", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-resolve-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading your funded programs…
      </div>
    );
  }

  if (!data?.stakes?.length) {
    return (
      <BlueGlowCard variant="subtle" className="text-sm text-resolve-muted">
        {CAPITAL_YIELD_COPY.portfolio.empty}
      </BlueGlowCard>
    );
  }

  const { summary, stakes } = data;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-emerald-400" />
        <h2 className="text-sm font-semibold text-white">{CAPITAL_YIELD_COPY.portfolio.title}</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/[0.08] bg-[#0a0f18]/60 px-4 py-3">
          <p className="text-[10px] uppercase text-resolve-muted-dim">
            {CAPITAL_YIELD_COPY.portfolio.principal}
          </p>
          <Money amount={summary.totalPrincipalUsd} size="md" className="mt-1" />
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-[#0a0f18]/60 px-4 py-3">
          <p className="text-[10px] uppercase text-resolve-muted-dim">
            {CAPITAL_YIELD_COPY.portfolio.impact}
          </p>
          <Money amount={summary.totalAttributedImpactUsd} size="md" className="mt-1 text-emerald-300" />
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
          <p className="text-[10px] uppercase text-emerald-200/80">Portfolio multiplier</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-300">
            {summary.portfolioMultiplier > 0 ?
              `${summary.portfolioMultiplier.toFixed(2)}×`
            : "—"}
          </p>
          <p className="text-[10px] text-resolve-muted">
            {summary.targetsMet} of {summary.stakeCount} at 2× target
          </p>
        </div>
      </div>

      <ul className="space-y-2">
        {stakes.map((s) => (
          <li
            key={s.stakeId}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium text-white">{s.programName}</p>
              <p className="text-[11px] text-resolve-muted">{s.communityName}</p>
            </div>
            <div className="text-right text-xs">
              <Money amount={s.principalUsd} size="sm" className="text-white" />
              <p className="mt-0.5 text-emerald-300">
                {s.yieldMultiplier.toFixed(2)}× ·{" "}
                <Money amount={s.attributedImpactUsd} size="sm" className="inline" />
              </p>
              <p className="text-[10px] text-resolve-muted-dim">
                {s.targetMet ?
                  CAPITAL_YIELD_COPY.portfolio.targetMet
                : CAPITAL_YIELD_COPY.portfolio.building}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
