"use client";

import clsx from "clsx";
import type { IntelligenceBrief } from "@/lib/mission/intelligence-brief";

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span
      className={clsx(
        "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        severity === "critical" && "bg-rose-500/20 text-rose-300",
        severity === "high" && "bg-amber-500/20 text-amber-200",
        severity === "medium" && "bg-blue-500/15 text-blue-200",
        severity === "low" && "bg-white/10 text-resolve-muted",
        severity === "info" && "bg-white/10 text-resolve-muted",
      )}
    >
      {severity}
    </span>
  );
}

export function IntelligenceBriefCard({
  brief,
  objective,
  compact,
}: {
  brief: IntelligenceBrief;
  objective?: string;
  compact?: boolean;
}) {
  return (
    <article
      className={clsx(
        "rounded-xl border border-white/[0.08] bg-[#0a0f18]/80",
        compact ? "p-4" : "p-5",
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-resolve-accent">
            {brief.capabilityLabel}
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-white">{brief.headline}</h2>
          {objective && (
            <p className="mt-1 text-xs text-resolve-muted-dim">Objective · {objective}</p>
          )}
        </div>
        {brief.findingCount > 0 && (
          <span className="text-[11px] tabular-nums text-resolve-muted">
            {brief.findingCount} signal{brief.findingCount === 1 ? "" : "s"}
          </span>
        )}
      </header>

      <p className="mt-3 text-sm leading-relaxed text-resolve-muted">{brief.summary}</p>

      {brief.priority && (
        <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">
              Highest priority
            </span>
            <SeverityBadge severity={brief.priority.severity} />
            <span className="text-[11px] text-resolve-muted">
              {Math.round(brief.priority.confidence * 100)}% confidence
            </span>
          </div>
          <p className="mt-2 text-sm font-medium text-white">{brief.priority.label}</p>
          <p className="mt-1 text-xs leading-relaxed text-resolve-muted">{brief.priority.reason}</p>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {brief.impact && (
          <div>
            <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">
              {brief.impact.label}
            </p>
            <p className="mt-0.5 text-sm font-medium text-white">{brief.impact.value}</p>
          </div>
        )}
        {brief.funding?.neededUsd !== undefined && brief.funding.neededUsd > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">
              Funding needed
            </p>
            <p className="mt-0.5 text-sm font-medium tabular-nums text-amber-200/90">
              ${brief.funding.neededUsd.toLocaleString()}
            </p>
          </div>
        )}
        {brief.funding?.deployUsd !== undefined && (
          <div>
            <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">
              Capital in scope
            </p>
            <p className="mt-0.5 text-sm font-medium tabular-nums text-white">
              ${brief.funding.deployUsd.toLocaleString()}
            </p>
          </div>
        )}
        {brief.funding?.availableUsd !== undefined && brief.funding.availableUsd > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">
              Treasury available
            </p>
            <p className="mt-0.5 text-sm font-medium tabular-nums text-emerald-300/90">
              ${brief.funding.availableUsd.toLocaleString()}
            </p>
          </div>
        )}
      </div>

      {brief.options.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">
            Recommended options
          </p>
          <ul className="mt-2 space-y-1">
            {brief.options.map((o) => (
              <li key={o.id} className="flex items-baseline gap-2 text-xs text-resolve-muted">
                <span className="text-resolve-accent">→</span>
                <span className="text-white/90">{o.label}</span>
                {o.detail && <span className="text-resolve-muted-dim">· {o.detail}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {brief.simulations && brief.simulations.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">Simulation</p>
          <ul className="mt-2 space-y-1">
            {brief.simulations.map((s) => (
              <li
                key={s.label}
                className="flex justify-between text-xs text-resolve-muted"
              >
                <span>{s.label}</span>
                <span className="tabular-nums text-white">{s.value}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {brief.recommendations.length > 0 && (
        <div className="mt-4 border-t border-white/[0.06] pt-3">
          <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">
            Recommendations
          </p>
          <ul className="mt-2 space-y-2">
            {brief.recommendations.map((r, i) => (
              <li key={i} className="text-xs">
                <span className="font-medium text-white/90">{r.label}</span>
                <span className="text-resolve-muted"> — {r.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {brief.evidence.length > 0 && (
        <p className="mt-4 text-[10px] text-resolve-muted-dim">
          Evidence · {brief.evidence.join(" · ")}
        </p>
      )}
    </article>
  );
}
