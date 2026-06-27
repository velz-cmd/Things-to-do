"use client";

import type { OpportunityCard } from "@/lib/workspace/advisors/opportunity-cards";
import type { PolicyProposal } from "@/lib/workspace/advisors/policy-proposals";

export type AllocationLine = {
  id: string;
  label: string;
  amountUsd: number;
};

function formatUsd(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function badgeToneClass(tone: OpportunityCard["badgeTone"]) {
  if (tone === "high") return "bg-rose-500/15 text-rose-200 ring-rose-500/25";
  if (tone === "claimable") return "bg-emerald-500/15 text-emerald-200 ring-emerald-500/25";
  return "bg-amber-500/15 text-amber-200 ring-amber-500/25";
}

export function MissionFundingLeaks({
  opportunities,
  title = "Funding leaks found",
}: {
  opportunities: OpportunityCard[];
  title?: string;
}) {
  if (!opportunities.length) return null;

  return (
    <section className="rounded-xl border border-resolve-border/60 bg-resolve-bg-deep/25 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-resolve-muted">
        {title}
      </h3>
      <ul className="mt-3 space-y-2">
        {opportunities.map((o) => (
          <li
            key={o.id}
            className="flex items-start justify-between gap-3 rounded-lg border border-resolve-border/40 px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{o.title}</p>
              <p className="mt-0.5 text-xs text-resolve-muted">{o.subtitle}</p>
            </div>
            <div className="shrink-0 text-right">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${badgeToneClass(o.badgeTone)}`}
              >
                {o.badge}
              </span>
              <p className="mt-1 text-xs font-medium text-white">{o.statB.value} gap</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function MissionSuggestedAllocation({ lines }: { lines: AllocationLine[] }) {
  if (!lines.length) return null;

  const total = lines.reduce((s, l) => s + l.amountUsd, 0);

  return (
    <section className="rounded-xl border border-resolve-border/60 bg-resolve-bg-deep/25 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-resolve-muted">
        Suggested allocation
      </h3>
      <ul className="mt-3 divide-y divide-resolve-border/40">
        {lines.map((line) => (
          <li key={line.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
            <span className="text-sm text-white/95">{line.label}</span>
            <span className="text-sm font-medium tabular-nums text-white">
              {formatUsd(line.amountUsd)}
            </span>
          </li>
        ))}
      </ul>
      {total > 0 && (
        <p className="mt-3 border-t border-resolve-border/40 pt-3 text-right text-xs text-resolve-muted">
          Total {formatUsd(total)}
        </p>
      )}
    </section>
  );
}

export function MissionTreasurySnippet({
  availableUsd,
  neededUsd,
}: {
  availableUsd: number;
  neededUsd: number;
}) {
  const shortfall = Math.max(0, neededUsd - availableUsd);
  if (neededUsd <= 0 && availableUsd <= 0) return null;

  return (
    <section className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-200/80">
        Treasury
      </h3>
      <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-resolve-muted">Available</dt>
          <dd className="mt-1 text-sm font-medium text-white">{formatUsd(availableUsd)}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-resolve-muted">Needed</dt>
          <dd className="mt-1 text-sm font-medium text-white">{formatUsd(neededUsd)}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-resolve-muted">Shortfall</dt>
          <dd className="mt-1 text-sm font-medium text-amber-200">{formatUsd(shortfall)}</dd>
        </div>
      </dl>
    </section>
  );
}

export function MissionInlinePolicy({
  policy,
  onEdit,
}: {
  policy: PolicyProposal;
  onEdit?: () => void;
}) {
  return (
    <section className="rounded-xl border border-resolve-border/60 bg-resolve-bg-deep/25 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-resolve-muted">
            Recommendation
          </p>
          <p className="mt-1 text-sm font-medium text-white">
            {policy.emoji} {policy.label}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-resolve-muted">{policy.description}</p>
        </div>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="shrink-0 rounded-lg border border-resolve-border px-2.5 py-1 text-[11px] text-resolve-muted transition hover:border-resolve-accent/40 hover:text-white"
          >
            Edit policy
          </button>
        )}
      </div>
      {policy.splits.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {policy.splits.map((s) => (
            <li
              key={s.label}
              className="rounded-lg border border-resolve-border/50 px-2.5 py-1 text-[11px] text-resolve-muted"
            >
              <span className="text-white/90">{s.label}</span> {s.percent}%
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
