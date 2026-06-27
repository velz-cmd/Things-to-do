"use client";

import { ExternalLink, Download, Share2 } from "lucide-react";
import type { MissionReport } from "@/lib/mission/mission-report";
import { missionReportToJson } from "@/lib/mission/mission-report";
import type { CapabilityAction } from "@/lib/mission/capabilities/types";
import { MissionCapabilityActions } from "@/components/resolve/mission-control/mission-capability-actions";
import { MissionResearchRefs } from "@/components/resolve/mission-control/mission-research-refs";
import { MissionFindings } from "@/components/resolve/mission-control/mission-findings";
import { MissionCapitalBlueprint } from "@/components/resolve/mission-control/mission-capital-blueprint";
import { MissionReportSections } from "@/components/resolve/mission-control/mission-report-sections";

export function MissionReportCard({
  report,
  topicName,
  onAction,
  onChip,
  actionsDisabled,
}: {
  report: MissionReport;
  topicName?: string;
  onAction?: (action: CapabilityAction) => void;
  onChip?: (text: string) => void;
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
    const payload = missionReportToJson(report);
    if (navigator.share) {
      await navigator.share({ title: report.headline, text: payload.slice(0, 500) }).catch(() => undefined);
    } else {
      await navigator.clipboard.writeText(payload).catch(() => undefined);
    }
  }


  return (
    <article className="space-y-4">
      <div>
        <p className="text-base font-semibold leading-snug text-white">{report.headline}</p>
        <p className="mt-2 text-sm leading-relaxed text-resolve-muted">{report.summary}</p>
      </div>

      {report.sourcesScanned.length > 0 && (
        <p className="text-[11px] text-resolve-muted-dim">
          {report.sourcesScanned.join(" · ")}
        </p>
      )}

      <div className="border-t border-white/[0.06]" />

      {report.researchReferences && report.researchReferences.length > 0 && (
          <MissionResearchRefs references={report.researchReferences} />
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

        <MissionReportSections
          understanding={report.understanding}
          capitalDesign={report.capitalDesign}
          executionPlan={report.executionPlan}
          risks={report.risks}
          recommendation={report.recommendation}
        />

        {report.capitalBlueprint && (
          <MissionCapitalBlueprint blueprint={report.capitalBlueprint} />
        )}

        {report.findings.length > 0 && onChip && (
          <MissionFindings findings={report.findings} onChip={onChip} disabled={actionsDisabled} />
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

        {onAction && report.actions.length > 0 && (
          <MissionCapabilityActions
            actions={report.actions}
            onAction={onAction}
            disabled={actionsDisabled}
          />
        )}

        <details className="group">
          <summary className="cursor-pointer text-[10px] uppercase tracking-wide text-resolve-muted-dim hover:text-resolve-muted">
            Export report
          </summary>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadJson}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] px-2.5 py-1 text-[10px] text-resolve-muted hover:text-white"
            >
              <Download className="h-3 w-3" />
              JSON
            </button>
            <button
              type="button"
              onClick={() => void shareReport()}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] px-2.5 py-1 text-[10px] text-resolve-muted hover:text-white"
            >
              <Share2 className="h-3 w-3" />
              Share
            </button>
            {topicName && (
              <span className="self-center text-[10px] text-resolve-muted-dim">
                {topicName} · {Math.round(report.confidence * 100)}%
              </span>
            )}
          </div>
        </details>
    </article>
  );
}
