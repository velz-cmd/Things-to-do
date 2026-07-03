"use client";

import clsx from "clsx";
import type { DiscoverCardNarrative } from "@/lib/discover/discover-card-narrative";

type Props = {
  narrative: DiscoverCardNarrative;
  className?: string;
};

const NARRATIVE_SECTIONS = [
  {
    key: "evidence",
    label: "Evidence",
    labelClass: "text-resolve-muted-dim",
    bodyClass: "text-resolve-muted",
    body: (n: DiscoverCardNarrative) => n.evidence,
  },
  {
    key: "problem",
    label: "Why money stopped",
    labelClass: "text-amber-200/70",
    bodyClass: "text-white/90",
    body: (n: DiscoverCardNarrative) => n.problem,
  },
  {
    key: "opportunity",
    label: "Opportunity",
    labelClass: "text-emerald-200/70",
    bodyClass: (n: DiscoverCardNarrative) =>
      clsx(
        "font-semibold tabular-nums",
        n.opportunityTone === "verified"
          ? "text-amber-200"
          : n.opportunityTone === "estimate"
            ? "text-amber-200/80"
            : "text-resolve-muted",
      ),
    body: (n: DiscoverCardNarrative) => n.opportunity,
  },
] as const;

/** Evidence → problem → opportunity — action marketplace card story. */
export function DiscoverCardNarrativeBlock({ narrative, className }: Props) {
  return (
    <div
      className={clsx(
        "mt-2 grid gap-3 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2.5 sm:grid-cols-3",
        className,
      )}
      aria-label="Value opportunity story"
    >
      {NARRATIVE_SECTIONS.map((section) => (
        <div key={section.key}>
          <p
            className={clsx(
              "text-[9px] font-semibold uppercase tracking-[0.14em]",
              section.labelClass,
            )}
          >
            {section.label}
          </p>
          <p
            className={clsx(
              "mt-0.5 text-[11px] leading-relaxed",
              typeof section.bodyClass === "function"
                ? section.bodyClass(narrative)
                : section.bodyClass,
            )}
          >
            {section.body(narrative)}
          </p>
        </div>
      ))}
    </div>
  );
}
