"use client";

import type { CapitalBlueprint } from "@/lib/mission/capital-os";

export function MissionCapitalBlueprint({ blueprint }: { blueprint: CapitalBlueprint }) {
  return (
    <section className="rounded-lg border border-violet-500/25 bg-violet-500/[0.04] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300/90">
            Capital Blueprint
          </p>
          <h3 className="mt-1 text-base font-semibold text-white">{blueprint.title}</h3>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold tabular-nums text-white">
            ${blueprint.totalCapitalUsd.toLocaleString()}
          </p>
          <p className="text-[10px] text-resolve-muted-dim">
            {blueprint.duration} · {Math.round(blueprint.confidence * 100)}% confidence
          </p>
        </div>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-resolve-muted">{blueprint.rationale}</p>

      <div className="mt-4">
        <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">Distribution</p>
        <ul className="mt-2 space-y-1.5">
          {blueprint.distribution.map((d) => (
            <li key={d.category} className="flex items-start justify-between gap-3 text-xs">
              <div className="min-w-0">
                <span className="font-medium text-white">{d.category}</span>
                <span className="ml-2 tabular-nums text-violet-200/90">{d.percent}%</span>
                {d.amountUsd != null && (
                  <span className="ml-1 tabular-nums text-resolve-muted">
                    · ${d.amountUsd.toLocaleString()}
                  </span>
                )}
                <p className="mt-0.5 text-[11px] text-resolve-muted-dim">{d.reason}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {blueprint.flows.length > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {blueprint.flows.map((f) => (
            <div key={f.mechanism} className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
              <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">Flow</p>
              <p className="mt-1 text-xs font-medium text-white">{f.mechanism}</p>
              <p className="mt-0.5 text-[11px] text-resolve-muted">
                {f.frequency} · {f.verification}
              </p>
              <p className="mt-0.5 text-[11px] text-emerald-300/80">{f.settlement}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">Success metrics</p>
          <ul className="mt-1 space-y-0.5">
            {blueprint.successMetrics.map((m) => (
              <li key={m} className="text-[11px] text-resolve-muted before:mr-1.5 before:content-['•']">
                {m}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">Rebalance triggers</p>
          <ul className="mt-1 space-y-0.5">
            {blueprint.rebalanceTriggers.map((t) => (
              <li key={t} className="text-[11px] text-resolve-muted before:mr-1.5 before:content-['•']">
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
