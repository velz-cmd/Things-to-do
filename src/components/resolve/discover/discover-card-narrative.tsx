"use client";

import clsx from "clsx";
import type { DiscoverCardNarrative } from "@/lib/discover/discover-card-narrative";

type Props = {
  narrative: DiscoverCardNarrative;
  className?: string;
};

const AMOUNT_TONE_CLASS: Record<DiscoverCardNarrative["opportunityTone"], string> = {
  verified: "text-emerald-300",
  estimate: "text-amber-200",
  not_synced: "text-resolve-muted",
  zero: "text-resolve-muted",
};

/**
 * Splits the composite opportunity line into a leading money figure (emphasised)
 * and the descriptive remainder so the dollar reads as the headline number.
 */
function splitOpportunity(narrative: DiscoverCardNarrative): {
  amount: string | null;
  detail: string;
} {
  const amount = narrative.opportunityAmount?.trim();
  const opportunity = narrative.opportunity?.trim() ?? "";

  if (amount && amount !== "Unpaid" && opportunity.startsWith(amount)) {
    return { amount, detail: opportunity.slice(amount.length).replace(/^\s+/, "") };
  }

  return { amount: null, detail: opportunity };
}

/**
 * Evidence → Problem → Opportunity — the action-marketplace card story.
 * A vertical narrative (not a status grid): muted proof line, a prominent
 * "why money stopped" statement, then the emphasised dollar opportunity.
 */
export function DiscoverCardNarrativeBlock({ narrative, className }: Props) {
  const { amount, detail } = splitOpportunity(narrative);

  return (
    <div
      className={clsx(
        "mt-2 space-y-1.5 rounded-lg border-l-2 border-white/10 bg-black/20 py-2 pl-3 pr-3",
        className,
      )}
      aria-label="Value opportunity story"
    >
      {/* Evidence — the proof that value exists */}
      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-resolve-muted">
        <span
          aria-hidden
          className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-emerald-400/70"
        />
        <span>{narrative.evidence}</span>
      </p>

      {/* Problem — why money stopped; the strongest read of the card */}
      <p className="text-[12.5px] font-semibold leading-snug text-white/95">
        {narrative.problem}
      </p>

      {/* Opportunity — the dollar and impact unlocked by acting */}
      <p className="flex flex-wrap items-baseline gap-x-1.5 text-[11px] leading-relaxed text-resolve-muted">
        {amount && (
          <span
            className={clsx(
              "text-[12.5px] font-semibold tabular-nums",
              AMOUNT_TONE_CLASS[narrative.opportunityTone],
            )}
          >
            {amount}
          </span>
        )}
        <span>{detail}</span>
      </p>
    </div>
  );
}
