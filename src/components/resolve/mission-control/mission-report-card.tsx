"use client";

import clsx from "clsx";
import { ExternalLink, Download, Share2 } from "lucide-react";
import type { MissionReport } from "@/lib/mission/mission-report";
import { missionReportToJson } from "@/lib/mission/mission-report";
import type { CapabilityAction } from "@/lib/mission/capabilities/types";
import { MissionCapabilityActions } from "@/components/resolve/mission-control/mission-capability-actions";

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTimestamp(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return iso;
  }
}

export function MissionReportCard({
  report,
  onAction,
  actionsDisabled,
}: {
  report: MissionReport;
  onAction?: (action: CapabilityAction) => void;
  actionsDisabled?: boolean;
}) {
  function downloadJson() {
    const blob = new Blob([missionReportToJson(report)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.reportId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function shareReport() {
    const url = `${window.location.origin}/mission?report=${report.reportId}`;
    if (navigator.share) {
      await navigator.share({ title: report.headline, url }).catch(() => undefined);
    } else {
      await navigator.clipboard.writeText(url).catch(() => undefined);
    }
  }

  return (
    <article className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#070b12]">
      <header className="border-b border-white/[0.06] px-5 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-400/90">
          Mission report · Arc testnet
        </p>
        <h2 className="mt-2 text-xl font-semibold leading-snug tracking-tight text-white sm:text-2xl">
          {report.objective}
        </h2>
        <p className="mt-2 font-mono text-[11px] text-resolve-muted-dim">
          Report {report.reportId}
          {report.missionId ? ` · Mission ${report.missionId.slice(0, 12)}…` : ""}
          {" · "}
          {formatTimestamp(report.completedAt)}
        </p>
      </header>

      <div className="grid gap-px bg-white/[0.04] sm:grid-cols-2 lg:grid-cols-4">
        <MetricCell label="Run status" value={report.status.replace("_", " ")} sub="Persisted ledger" />
        <MetricCell
          label="Completed in"
          value={formatDuration(report.durationMs)}
          sub={report.capabilityLabel}
        />
        <MetricCell
          label="Confidence"
          value={`${Math.round(report.confidence * 100)}%`}
          sub={`${report.signalsFound} signal${report.signalsFound === 1 ? "" : "s"}`}
        />
        <MetricCell
          label="Communities"
          value={String(report.communitiesAnalyzed)}
          sub={
            report.criticalCount > 0 ?
              `${report.criticalCount} critical`
            : "analyzed"
          }
        />
      </div>

      <div className="space-y-5 px-5 py-5">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">Result</p>
          <p className="mt-1 text-lg font-semibold text-white">{report.headline}</p>
          <p className="mt-1 text-sm text-resolve-muted">{report.summary}</p>
        </div>

        {report.sourcesScanned.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">
              Evidence scanned
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {report.sourcesScanned.map((s) => (
                <li
                  key={s}
                  className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2 py-1 text-[11px] text-emerald-200/90"
                >
                  ✓ {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {report.priority && (
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">
              Highest priority
            </p>
            <p className="mt-1 text-sm font-medium text-white">{report.priority.label}</p>
            <p className="mt-1 text-xs text-resolve-muted">{report.priority.reason}</p>
            {report.funding?.neededUsd !== undefined && report.funding.neededUsd > 0 && (
              <p className="mt-2 text-sm tabular-nums text-amber-200/90">
                Funding gap · ${report.funding.neededUsd.toLocaleString()}
              </p>
            )}
            {report.impact && (
              <p className="mt-1 text-xs text-resolve-muted">
                {report.impact.label} · {report.impact.value}
              </p>
            )}
          </div>
        )}

        {report.simulations && report.simulations.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">
              Recommended allocation
            </p>
            <ul className="mt-2 space-y-1">
              {report.simulations.map((s) => (
                <li key={s.label} className="flex justify-between text-xs text-resolve-muted">
                  <span>{s.label}</span>
                  <span className="tabular-nums text-white">{s.value}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {report.evidenceLinks.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">Evidence</p>
            <ul className="mt-2 space-y-1">
              {report.evidenceLinks.map((link) => (
                <li key={link.label}>
                  {link.href ?
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-resolve-accent hover:underline"
                    >
                      Open {link.label}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  : <span className="text-xs text-resolve-muted">{link.label}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {report.settlement && (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
            <p className="text-[10px] uppercase tracking-wide text-emerald-300/80">Settlement</p>
            <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
              {report.settlement.amountUsd != null && (
                <div>
                  <span className="text-resolve-muted">USDC </span>
                  <span className="tabular-nums font-medium text-white">
                    ${report.settlement.amountUsd.toLocaleString()}
                  </span>
                </div>
              )}
              {report.settlement.recipientCount != null && (
                <div>
                  <span className="text-resolve-muted">Recipients </span>
                  <span className="tabular-nums text-white">{report.settlement.recipientCount}</span>
                </div>
              )}
              {report.settlement.batchId && (
                <div className="font-mono text-[10px] text-resolve-muted-dim sm:col-span-2">
                  Batch {report.settlement.batchId}
                </div>
              )}
            </div>
            {report.settlement.explorerUrl && (
              <a
                href={report.settlement.explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-xs text-emerald-300 hover:underline"
              >
                View on Arcscan
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">
          <button
            type="button"
            onClick={downloadJson}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] px-3 py-1.5 text-[11px] text-resolve-muted hover:text-white"
          >
            <Download className="h-3 w-3" />
            Export JSON
          </button>
          <button
            type="button"
            onClick={() => void shareReport()}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] px-3 py-1.5 text-[11px] text-resolve-muted hover:text-white"
          >
            <Share2 className="h-3 w-3" />
            Share
          </button>
          {report.persisted && (
            <span className="self-center text-[10px] text-resolve-muted-dim">Persisted ledger</span>
          )}
        </div>

        {onAction && report.actions.length > 0 && (
          <MissionCapabilityActions
            actions={report.actions}
            onAction={onAction}
            disabled={actionsDisabled}
          />
        )}
      </div>
    </article>
  );
}

function MetricCell({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-[#0a0f18] px-4 py-3">
      <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">{label}</p>
      <p className={clsx("mt-1 text-lg font-semibold capitalize tabular-nums text-white")}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[11px] text-resolve-muted-dim">{sub}</p>}
    </div>
  );
}
