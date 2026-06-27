"use client";

import clsx from "clsx";
import type { MissionFinding } from "@/lib/workspace/advisors/intelligence-findings";
import { rankLabel } from "@/lib/workspace/advisors/intelligence-findings";

const SEVERITY_STYLES = {
  critical: {
    dot: "bg-rose-400",
    badge: "bg-rose-500/15 text-rose-200 ring-rose-500/25",
    border: "border-rose-500/20",
  },
  opportunity: {
    dot: "bg-amber-400",
    badge: "bg-amber-500/15 text-amber-200 ring-amber-500/25",
    border: "border-amber-500/20",
  },
  info: {
    dot: "bg-sky-400",
    badge: "bg-sky-500/15 text-sky-200 ring-sky-500/25",
    border: "border-sky-500/20",
  },
} as const;

export function MissionFindings({
  findings,
  onChip,
  disabled,
}: {
  findings: MissionFinding[];
  onChip: (text: string) => void;
  disabled?: boolean;
}) {
  if (!findings.length) return null;

  return (
    <div className="space-y-3">
      {findings.map((f) => {
        const style = SEVERITY_STYLES[f.severity];
        return (
          <section
            key={f.id}
            className={clsx(
              "rounded-xl border bg-resolve-bg-deep/30 p-4",
              style.border,
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-wide text-resolve-muted-dim">
                  {rankLabel(f.rank)}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span
                    className={clsx(
                      "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
                      style.badge,
                    )}
                  >
                    <span className={clsx("h-1.5 w-1.5 rounded-full", style.dot)} />
                    {f.severityLabel}
                  </span>
                  <span className="text-sm font-medium text-white">{f.title}</span>
                </div>
              </div>
              <span className="shrink-0 text-[10px] text-resolve-muted">
                {f.confidence}% confidence
              </span>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-white/95">{f.insight}</p>

            {f.impact && (
              <p className="mt-2 text-xs text-resolve-muted">
                <span className="text-resolve-muted-dim">Impact · </span>
                {f.impact}
              </p>
            )}

            {f.bullets && f.bullets.length > 0 && (
              <ul className="mt-3 space-y-1">
                {f.bullets.map((b) => (
                  <li key={b} className="text-xs text-resolve-muted before:mr-2 before:content-['•']">
                    {b}
                  </li>
                ))}
              </ul>
            )}

            {f.metric && (
              <p className="mt-3 text-xs text-resolve-muted">
                <span className="text-white/90">{f.metric.label}</span> · {f.metric.value}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-1.5">
              {f.chips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChip(chip)}
                  className="rounded-full border border-resolve-border/70 px-2.5 py-1 text-[11px] text-resolve-muted transition hover:border-resolve-accent/40 hover:text-white disabled:opacity-40"
                >
                  {chip}
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
