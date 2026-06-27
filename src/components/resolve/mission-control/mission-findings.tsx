"use client";

import { useState } from "react";
import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import type { MissionFinding } from "@/lib/workspace/advisors/intelligence-findings";
import { rankLabel } from "@/lib/workspace/advisors/intelligence-findings";
import { chipsFromFinding } from "@/lib/mission/contextual-actions";

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

function FindingCard({
  finding,
  onChip,
  disabled,
}: {
  finding: MissionFinding;
  onChip: (text: string) => void;
  disabled?: boolean;
}) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const style = SEVERITY_STYLES[finding.severity];
  const chips = chipsFromFinding(finding);
  const hasEvidence =
  Boolean(finding.bullets?.length) || Boolean(finding.metric) || Boolean(finding.impact);

  return (
    <section className={clsx("rounded-xl border bg-resolve-bg-deep/30 p-4", style.border)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wide text-resolve-muted-dim">
            {rankLabel(finding.rank)}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span
              className={clsx(
                "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
                style.badge,
              )}
            >
              <span className={clsx("h-1.5 w-1.5 rounded-full", style.dot)} />
              {finding.severityLabel}
            </span>
            <span className="text-sm font-medium text-white">{finding.title}</span>
          </div>
        </div>
        <span className="shrink-0 text-[10px] text-resolve-muted">{finding.confidence}%</span>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-white/95">{finding.insight}</p>

      {hasEvidence && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setEvidenceOpen((o) => !o)}
            className="flex items-center gap-1.5 text-[11px] text-resolve-muted transition hover:text-white"
          >
            <ChevronDown
              className={clsx("h-3.5 w-3.5 transition", evidenceOpen && "rotate-180")}
            />
            {evidenceOpen ? "Hide evidence" : "Show evidence"}
          </button>
          {evidenceOpen && (
            <div className="mt-2 space-y-2 border-l border-white/[0.08] pl-3">
              {finding.impact && (
                <p className="text-xs text-resolve-muted">{finding.impact}</p>
              )}
              {finding.bullets && finding.bullets.length > 0 && (
                <ul className="space-y-1">
                  {finding.bullets.map((b) => (
                    <li
                      key={b}
                      className="text-xs text-resolve-muted before:mr-2 before:content-['•']"
                    >
                      {b}
                    </li>
                  ))}
                </ul>
              )}
              {finding.metric && (
                <p className="text-xs text-resolve-muted">
                  <span className="text-white/90">{finding.metric.label}</span> ·{" "}
                  {finding.metric.value}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-1.5">
        {chips.map((chip) => (
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
}

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
      {findings.map((f) => (
        <FindingCard key={f.id} finding={f} onChip={onChip} disabled={disabled} />
      ))}
    </div>
  );
}
