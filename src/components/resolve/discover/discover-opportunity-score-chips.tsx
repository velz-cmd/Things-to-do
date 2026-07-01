"use client";

import clsx from "clsx";
import type { OpportunityScoreChip } from "@/lib/discover/opportunity-score";

const PROVENANCE_CLASS: Record<OpportunityScoreChip["provenance"], string> = {
  ledger: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  program: "border-violet-500/30 bg-violet-500/10 text-violet-100",
  estimate: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  sensor: "border-cyan-500/30 bg-cyan-500/10 text-cyan-100",
  heuristic: "border-white/15 bg-white/[0.04] text-resolve-muted",
};

const PROVENANCE_DOT: Record<OpportunityScoreChip["provenance"], string> = {
  ledger: "bg-emerald-400",
  program: "bg-violet-400",
  estimate: "bg-amber-400",
  sensor: "bg-cyan-400",
  heuristic: "bg-resolve-muted-dim",
};

type Props = {
  chips: OpportunityScoreChip[];
  composite?: number;
  compact?: boolean;
  className?: string;
};

export function DiscoverOpportunityScoreChips({
  chips,
  composite,
  compact,
  className,
}: Props) {
  if (!chips.length) return null;

  return (
    <div className={clsx("space-y-2", className)}>
      {composite != null && !compact && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
            Opportunity score
          </span>
          <span className="rounded-md border border-resolve-accent/30 bg-resolve-accent/10 px-2 py-0.5 text-sm font-semibold tabular-nums text-white">
            {composite}
          </span>
        </div>
      )}
      <div className={clsx("flex flex-wrap gap-1.5", compact && "gap-1")}>
        {chips.map((chip) => (
          <span
            key={chip.dimension}
            title={`${chip.label}: ${chip.display} · ${chip.source} (${chip.provenance})`}
            className={clsx(
              "inline-flex items-center gap-1 rounded-md border px-2 py-0.5",
              compact ? "text-[9px]" : "text-[10px]",
              PROVENANCE_CLASS[chip.provenance],
            )}
          >
            <span
              className={clsx("h-1.5 w-1.5 shrink-0 rounded-full", PROVENANCE_DOT[chip.provenance])}
              aria-hidden
            />
            <span className="font-medium">{chip.label}</span>
            <span className="tabular-nums opacity-90">{chip.display}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
