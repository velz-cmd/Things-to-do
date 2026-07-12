"use client";

import clsx from "clsx";
import type { DiscoverCardNarrative } from "@/lib/discover/discover-card-narrative";

type Props = {
  narrative: DiscoverCardNarrative;
  className?: string;
  compact?: boolean;
};

const AMOUNT_TONE_CLASS: Record<DiscoverCardNarrative["opportunityTone"], string> = {
  verified: "text-emerald-300",
  estimate: "text-amber-200",
  not_synced: "text-resolve-muted",
  zero: "text-resolve-muted",
};

function splitOpportunity(narrative: DiscoverCardNarrative): {
  amount: string | null;
  detail: string;
} {
  const amount = narrative.opportunityAmount?.trim();
  const opportunity = narrative.opportunity?.trim() ?? "";

  if (amount && amount !== "Unpaid" && opportunity.includes(amount)) {
    return { amount, detail: opportunity.replace(amount, "").replace(/^[\s:+-]+/, "") };
  }

  return { amount: null, detail: opportunity };
}

export function DiscoverCardNarrativeBlock({ narrative, className, compact = false }: Props) {
  const { amount, detail } = splitOpportunity(narrative);

  return (
    <div
      className={clsx(
        compact
          ? "mt-2 space-y-2 rounded-lg border border-white/[0.05] bg-white/[0.025] px-3 py-2.5"
          : "mt-2 space-y-2 rounded-lg border border-white/8 bg-black/20 p-3",
        className,
      )}
      aria-label="Value opportunity story"
    >
      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-resolve-muted">
        <span
          aria-hidden
          className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-emerald-400/70"
        />
        <span>{narrative.evidence}</span>
      </p>

      <p className="text-[12.5px] font-semibold leading-snug text-white/95">
        {narrative.problem}
      </p>

      <div className={clsx("grid gap-2 border-t border-white/8 pt-2 sm:grid-cols-4", compact && "grid-cols-2")}>
        <Metric
          label={narrative.valueLabel}
          value={amount ?? narrative.valueText}
          tone={AMOUNT_TONE_CLASS[narrative.opportunityTone]}
        />
        <Metric label={narrative.countLabel} value={narrative.countText} />
        <Metric label="Confidence" value={narrative.confidenceText} />
        <Metric label="Blocker" value={narrative.blockerText} tone="text-amber-100" />
      </div>

      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] leading-relaxed text-resolve-muted">
        <span>{narrative.updatedText}</span>
        {detail && <span>{detail}</span>}
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "text-white",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[9px] font-semibold uppercase tracking-wide text-resolve-muted-dim">
        {label}
      </div>
      <div className={clsx("mt-0.5 truncate text-[13px] font-semibold tabular-nums", tone)}>
        {value}
      </div>
    </div>
  );
}
