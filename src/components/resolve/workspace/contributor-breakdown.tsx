"use client";

import { useState } from "react";
import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import { Panel } from "@/components/resolve/ui/panel";
import { Money } from "@/components/resolve/ui/money";
import type { ContributorAllocation } from "@/lib/github/types";

function confidenceFromTrust(trustScore: number): number {
  return Math.min(99, Math.max(70, Math.round(trustScore * 0.85 + 15)));
}

function barWidth(sharePercent: number, maxShare: number): string {
  const pct = maxShare > 0 ? (sharePercent / maxShare) * 100 : 0;
  return `${Math.max(8, Math.round(pct))}%`;
}

export function ContributorBreakdown({
  contributors,
  fundPoolUsd,
}: {
  contributors: ContributorAllocation[];
  fundPoolUsd: number;
}) {
  const sorted = [...contributors].sort((a, b) => b.sharePercent - a.sharePercent);
  const maxShare = sorted[0]?.sharePercent ?? 1;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">Contribution breakdown</h3>
        <p className="text-xs text-resolve-muted">
          {sorted.length} contributors · <Money amount={fundPoolUsd} size="sm" className="inline" />
        </p>
      </div>

      <ul className="space-y-2">
        {sorted.map((c) => (
          <ContributorRow key={c.login} contributor={c} maxShare={maxShare} />
        ))}
      </ul>
    </div>
  );
}

function ContributorRow({
  contributor: c,
  maxShare,
}: {
  contributor: ContributorAllocation;
  maxShare: number;
}) {
  const [open, setOpen] = useState(false);
  const confidence = confidenceFromTrust(c.trustScore);
  const whyLines = c.topEvidence.length > 0 ? c.topEvidence : c.verdicts.flatMap((v) => v.evidence).slice(0, 4);

  return (
    <Panel className="overflow-hidden p-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-3 p-4 text-left transition hover:bg-white/[0.02]"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium text-white">@{c.login}</p>
            <div className="flex items-center gap-3 text-sm">
              <span className="tabular-nums text-resolve-muted">{c.sharePercent}%</span>
              <Money amount={c.payoutUsd} size="sm" />
            </div>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-resolve-accent/80"
              style={{ width: barWidth(c.sharePercent, maxShare) }}
            />
          </div>
          {!open && whyLines[0] && (
            <p className="mt-2 line-clamp-1 text-xs text-resolve-muted">{whyLines[0]}</p>
          )}
        </div>
        <ChevronDown
          className={clsx("mt-1 h-4 w-4 shrink-0 text-resolve-muted transition", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="border-t border-resolve-border px-4 pb-4">
          <p className="pt-3 text-[10px] font-medium uppercase tracking-wider text-resolve-muted">Why?</p>
          <ul className="mt-2 space-y-1.5 text-xs text-resolve-muted">
            {whyLines.map((line, i) => (
              <li key={i}>· {line}</li>
            ))}
          </ul>
          <p className="mt-3 text-[10px] text-resolve-muted-dim">
            Confidence <span className="font-medium text-emerald-300">{confidence}%</span>
            {" · "}
            {c.prCount} merged PR{c.prCount === 1 ? "" : "s"} in window
          </p>
        </div>
      )}
    </Panel>
  );
}
