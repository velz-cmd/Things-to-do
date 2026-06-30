"use client";

import clsx from "clsx";
import { INFRASTRUCTURE_PHASES } from "@/lib/economy/phases";
import type { InfrastructurePhase } from "@/lib/economy/types";

const STATUS_STYLES: Record<
  InfrastructurePhase["status"],
  { dot: string; label: string; text: string }
> = {
  complete: {
    dot: "bg-emerald-400",
    label: "Complete",
    text: "text-emerald-300",
  },
  in_progress: {
    dot: "bg-sky-400",
    label: "In progress",
    text: "text-sky-300",
  },
  partial: {
    dot: "bg-amber-400",
    label: "Partial",
    text: "text-amber-300",
  },
  planned: {
    dot: "bg-white/30",
    label: "Planned",
    text: "text-resolve-muted",
  },
};

const GROUP_LABELS = {
  shipped: "Shipped foundation",
  codex: "Codex infrastructure",
  advanced: "Advanced phases",
} as const;

type Props = {
  variant?: "full" | "compact";
  filterGroup?: InfrastructurePhase["group"];
};

export function PhaseRoadmapPanel({ variant = "full", filterGroup }: Props) {
  const phases = filterGroup
    ? INFRASTRUCTURE_PHASES.filter((p) => p.group === filterGroup)
    : INFRASTRUCTURE_PHASES;

  const grouped = (["shipped", "codex", "advanced"] as const).map((group) => ({
    group,
    phases: phases.filter((p) => p.group === group),
  })).filter((g) => g.phases.length > 0);

  return (
    <section className="space-y-6">
      {variant === "full" && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-accent">
            Infrastructure roadmap
          </p>
          <h3 className="mt-2 text-lg font-semibold text-white">
            Professional phases — shipped to advanced
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-resolve-muted">
            Technical phases 0–5 are live. Codex layers add entry doors, capital modes, and
            repayment. Advanced phases cover funded founders, DAO governance, and B2B risk.
          </p>
        </div>
      )}

      {grouped.map(({ group, phases: groupPhases }) => (
        <div key={group}>
          {variant === "full" && (
            <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-resolve-muted-dim">
              {GROUP_LABELS[group]}
            </p>
          )}
          <ul className={variant === "compact" ? "space-y-2" : "space-y-3"}>
            {groupPhases.map((phase) => {
              const style = STATUS_STYLES[phase.status];
              return (
                <li
                  key={phase.id}
                  className={clsx(
                    "rounded-xl border border-white/[0.06] bg-black/20",
                    variant === "compact" ? "px-3 py-2.5" : "px-4 py-3",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={clsx("h-2 w-2 shrink-0 rounded-full", style.dot)} />
                        <p className="text-sm font-medium text-white">{phase.name}</p>
                      </div>
                      <p className="mt-1 text-xs text-resolve-muted">{phase.summary}</p>
                      {variant === "full" && phase.deliverables.length > 0 && (
                        <ul className="mt-2 flex flex-wrap gap-1.5">
                          {phase.deliverables.map((d) => (
                            <li
                              key={d}
                              className="rounded border border-white/[0.06] px-2 py-0.5 text-[10px] text-resolve-muted-dim"
                            >
                              {d}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <span
                      className={clsx(
                        "shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[9px] font-medium uppercase",
                        style.text,
                      )}
                    >
                      {style.label}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
