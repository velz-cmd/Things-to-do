"use client";

import type { MissionReport } from "@/lib/mission/mission-report";
import type { CommunityKind } from "@/lib/mission/community/types";
import { confidencePercent } from "@/lib/mission/normalize-confidence";

/** Compact topic strip — only after analysis returns. */
export function MissionWorldSnapshot({
  topic,
  kind,
  report,
}: {
  topic: string;
  kind: CommunityKind;
  report?: MissionReport;
}) {
  if (!report) {
    return (
      <div className="border-b border-white/[0.06] px-4 py-2.5 lg:px-6">
        <h2 className="text-sm font-medium text-white">{topic}</h2>
      </div>
    );
  }

  const pct = confidencePercent(report.confidence);
  const gap =
    report.funding?.neededUsd ?
      `$${Math.round(report.funding.neededUsd / 1000)}k`
    : "—";

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-white/[0.06] px-4 py-2.5 text-xs lg:px-6">
      <h2 className="text-sm font-semibold text-white">{topic}</h2>
      <span className="text-resolve-muted">
        Signals <span className="tabular-nums text-white">{report.signalsFound}</span>
      </span>
      <span className="text-resolve-muted">
        Risks <span className="tabular-nums text-white">{report.criticalCount}</span>
      </span>
      <span className="text-resolve-muted">
        Gap <span className="tabular-nums text-white">{gap}</span>
      </span>
      <span className="text-resolve-muted">
        Confidence <span className="tabular-nums text-white">{pct}%</span>
      </span>
    </div>
  );
}
