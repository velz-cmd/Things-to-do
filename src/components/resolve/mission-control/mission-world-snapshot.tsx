"use client";

import type { MissionReport } from "@/lib/mission/mission-report";
import type { CommunityKind } from "@/lib/mission/community/types";

type SnapshotMetric = { label: string; value: string };

function metricsForWorld(
  topic: string,
  kind: CommunityKind,
  report?: MissionReport,
): SnapshotMetric[] {
  const fundingGap = report?.funding?.neededUsd;
  const confidence = report ? `${Math.round(report.confidence * 100)}%` : "—";
  const critical = report?.criticalCount ?? 0;
  const signals = report?.signalsFound ?? 0;
  const sources = report?.sourcesScanned?.slice(0, 4).join(" · ") || "—";

  if (kind === "music") {
    return [
      { label: "Community", value: topic },
      { label: "Attribution gaps", value: signals > 0 ? String(signals) : "Scanning" },
      { label: "Funding gap", value: fundingGap ? `$${(fundingGap / 1_000_000).toFixed(1)}M` : "—" },
      { label: "Confidence", value: confidence },
      { label: "Evidence", value: sources },
    ];
  }

  if (kind === "research") {
    return [
      { label: "Community", value: topic },
      { label: "Grant gaps", value: signals > 0 ? String(signals) : "—" },
      { label: "Funding gap", value: fundingGap ? `$${Math.round(fundingGap / 1000)}k` : "—" },
      { label: "Critical risks", value: String(critical) },
      { label: "Evidence", value: sources },
    ];
  }

  return [
    { label: "Community health", value: confidence === "—" ? "Analyzing" : confidence },
    {
      label: "Funding gap",
      value: fundingGap ? `$${(fundingGap / 1_000_000).toFixed(1)}M` : report?.funding?.neededUsd === 0 ? "Low" : "—",
    },
    { label: "Critical risks", value: String(critical) },
    { label: "Signals", value: String(signals) },
    { label: "Evidence", value: sources },
  ];
}

export function MissionWorldSnapshot({
  topic,
  kind,
  report,
}: {
  topic: string;
  kind: CommunityKind;
  report?: MissionReport;
}) {
  const metrics = metricsForWorld(topic, kind, report);

  return (
    <div className="border-b border-white/[0.06] bg-[#070b12]/80 px-4 py-4 lg:px-6">
      <h2 className="text-lg font-semibold text-white">{topic}</h2>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {metrics.map((m) => (
          <div key={m.label}>
            <dt className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">{m.label}</dt>
            <dd className="mt-0.5 text-sm font-medium tabular-nums text-white">{m.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
