"use client";

import { ExternalLink } from "lucide-react";
import type { MissionReport } from "@/lib/mission/mission-report";
import type { CapabilityAction } from "@/lib/mission/capabilities/types";
import { MissionCapabilityActions } from "@/components/resolve/mission-control/mission-capability-actions";
import { MissionCapitalBlueprint } from "@/components/resolve/mission-control/mission-capital-blueprint";
import { MissionResponseShell } from "@/components/resolve/mission-control/mission-chat-bubble";
import { confidencePercent } from "@/lib/mission/normalize-confidence";

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "link";
  }
}

function shortTitle(title: string, max = 72): string {
  const t = title.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function dedupeBullets(report: MissionReport): string[] {
  const seen = new Set<string>();
  const bullets: string[] = [];

  for (const f of report.findings.slice(0, 4)) {
    const line = `${f.title}: ${f.insight}`.trim();
    const key = line.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      bullets.push(line);
    }
  }

  if (bullets.length === 0 && report.recommendations.length > 0) {
    for (const r of report.recommendations.slice(0, 4)) {
      const line = r.detail ? `${r.label} — ${r.detail}` : r.label;
      if (!seen.has(line.toLowerCase())) bullets.push(line);
    }
  }

  return bullets.slice(0, 4);
}

function sourceChips(report: MissionReport): Array<{ label: string; href?: string }> {
  const chips: Array<{ label: string; href?: string }> = [];
  const seen = new Set<string>();

  for (const link of report.evidenceLinks) {
    if (seen.has(link.source)) continue;
    seen.add(link.source);
    chips.push({ label: link.source, href: link.href });
    if (chips.length >= 4) break;
  }

  if (chips.length === 0 && report.sourcesScanned.length > 0) {
    for (const s of report.sourcesScanned.slice(0, 4)) {
      chips.push({ label: s });
    }
  }

  return chips;
}

/** Compact chat response — summary first, bullets, sources, actions. No walls of text. */
export function MissionReportCard({
  report,
  onAction,
  actionsDisabled,
}: {
  report: MissionReport;
  topicName?: string;
  onAction?: (action: CapabilityAction) => void;
  onChip?: (text: string) => void;
  actionsDisabled?: boolean;
}) {
  const bullets = dedupeBullets(report);
  const chips = sourceChips(report);
  const refs = (report.researchReferences ?? [])
    .filter((r) => r.url && r.title.length > 8)
    .slice(0, 3);
  const pct = confidencePercent(report.confidence);
  const actions = report.actions.slice(0, 4);

  return (
    <MissionResponseShell>
      {/* Summary first */}
      <p className="text-[15px] font-semibold leading-snug text-white">{report.headline}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-white/75">{report.summary}</p>

      {report.funding?.neededUsd != null && report.funding.neededUsd > 0 && (
        <p className="mt-2 text-sm tabular-nums text-amber-200/90">
          Funding gap · ${report.funding.neededUsd.toLocaleString()}
        </p>
      )}

      {/* Bullets — scannable */}
      {bullets.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-white/[0.06] pt-3">
          {bullets.map((b) => (
            <li key={b} className="flex gap-2 text-sm text-white/85">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-sky-400" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Source chips */}
      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {chips.map((c) =>
            c.href ?
              <a
                key={c.label}
                href={c.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[11px] text-sky-200/90 hover:border-sky-500/30"
              >
                {c.label}
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            : <span
                key={c.label}
                className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[11px] text-resolve-muted"
              >
                {c.label}
              </span>,
          )}
          <span className="self-center text-[10px] text-resolve-muted-dim">{pct}% confidence</span>
        </div>
      )}

      {/* External resources — max 3, domain labels */}
      {refs.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-white/[0.06] pt-3">
          {refs.map((ref) => (
            <li key={ref.url}>
              <a
                href={ref.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-[12px] text-sky-300/90 hover:text-sky-200 hover:underline"
              >
                <ExternalLink className="h-3 w-3 shrink-0" />
                <span className="truncate">{shortTitle(ref.title)}</span>
                <span className="shrink-0 text-[10px] text-resolve-muted-dim">
                  {domainFromUrl(ref.url)}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {report.simulations && report.simulations.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-white/[0.06] pt-3">
          {report.simulations.slice(0, 4).map((s) => (
            <li key={s.label} className="flex justify-between text-xs text-resolve-muted">
              <span>{s.label}</span>
              <span className="tabular-nums text-white">{s.value}</span>
            </li>
          ))}
        </ul>
      )}

      {report.capitalBlueprint && (
        <div className="mt-4 border-t border-white/[0.06] pt-3">
          <MissionCapitalBlueprint blueprint={report.capitalBlueprint} />
        </div>
      )}

      {report.settlement && (
        <p className="mt-3 text-xs text-emerald-300/90">
          Settlement · ${report.settlement.amountUsd?.toLocaleString() ?? "—"} USDC
          {report.settlement.explorerUrl && (
            <>
              {" · "}
              <a href={report.settlement.explorerUrl} target="_blank" rel="noreferrer" className="underline">
                View receipt
              </a>
            </>
          )}
        </p>
      )}

      {onAction && actions.length > 0 && (
        <div className="mt-4 border-t border-white/[0.06] pt-3">
          <MissionCapabilityActions actions={actions} onAction={onAction} disabled={actionsDisabled} />
        </div>
      )}
    </MissionResponseShell>
  );
}
