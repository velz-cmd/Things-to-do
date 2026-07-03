"use client";

import clsx from "clsx";
import type { DiscoverCardNarrative } from "@/lib/discover/discover-card-narrative";

type Props = {
  narrative: DiscoverCardNarrative;
  className?: string;
};

/** Evidence → problem → opportunity — action marketplace card story. */
export function DiscoverCardNarrativeBlock({ narrative, className }: Props) {
  return (
    <div className={clsx("mt-2 space-y-2 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2.5", className)}>
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-resolve-muted-dim">
          Evidence
        </p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-resolve-muted">{narrative.evidence}</p>
      </div>
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-amber-200/70">
          Why money stopped
        </p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-white/90">{narrative.problem}</p>
      </div>
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-emerald-200/70">
          Opportunity
        </p>
        <p
          className={clsx(
            "mt-0.5 text-[11px] font-semibold leading-relaxed tabular-nums",
            narrative.opportunityTone === "verified"
              ? "text-amber-200"
              : narrative.opportunityTone === "estimate"
                ? "text-amber-200/80"
                : "text-resolve-muted",
          )}
        >
          {narrative.opportunity}
        </p>
      </div>
    </div>
  );
}
