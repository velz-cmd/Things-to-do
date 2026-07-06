"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ExternalLink, Receipt } from "lucide-react";
import { loadMissionReport, type MissionReportRecord } from "@/lib/mission/mission-report-store";
import { Money } from "@/components/resolve/ui/money";
import { formatAgentPrice } from "@/lib/agent/agent-signal-format";

export function MissionReportView({ reportId }: { reportId: string }) {
  const [report, setReport] = useState<MissionReportRecord | null>(null);

  useEffect(() => {
    setReport(loadMissionReport(reportId));
  }, [reportId]);

  if (!report) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <p className="text-sm text-resolve-muted">
          Mission receipt not found in this browser. Run Simulate → Authorize in Mission to generate one.
        </p>
        <Link href="/mission" className="mt-4 inline-block text-sm text-resolve-accent hover:underline">
          Open Mission
        </Link>
      </div>
    );
  }

  const sim = report.simulation;
  const statusLabel =
    report.status === "authorized"
      ? "Authorized"
      : report.status === "simulated"
        ? "Simulated"
        : "Draft";

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 lg:px-8">
      <Link
        href="/mission"
        className="inline-flex items-center gap-1 text-xs text-resolve-muted hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Mission
      </Link>

      <header className="mt-6 rounded-xl border border-violet-500/25 bg-violet-500/[0.06] p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300/90">
          Mission decision receipt
        </p>
        <h1 className="mt-2 text-xl font-semibold text-white">{report.objective}</h1>
        <p className="mt-2 text-sm text-resolve-muted">{report.communityLabel} · {statusLabel}</p>
        <div className="mt-4 flex flex-wrap gap-4 text-xs">
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-resolve-muted">
            ID {report.id}
          </span>
          {report.agentSignalUsd > 0 && (
            <span className="text-emerald-300">
              Agent signal {formatAgentPrice(report.agentSignalUsd)}
            </span>
          )}
          {report.policy && (
            <span className="text-resolve-muted">Policy · {report.policy}</span>
          )}
        </div>
      </header>

      {sim && (
        <section className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-100">
            <CheckCircle2 className="h-4 w-4" />
            {report.status === "authorized" ? "Decision authorized" : "Simulation record"}
          </p>
          <ul className="mt-3 space-y-1 text-sm text-resolve-muted">
            <li>{sim.clearedAuthorizations} authorizations in package</li>
            <li>
              <Money amount={sim.totalPayeeUsd} size="sm" className="inline" /> allocated across payees
            </li>
            {sim.checkpointReached && <li>Milestone checkpoint reachable</li>}
            {report.fundTxLabel && <li>{report.fundTxLabel}</li>}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
          Payees
        </h2>
        <ul className="mt-3 divide-y divide-white/[0.06] rounded-xl border border-white/[0.08]">
          {report.payees.map((p) => (
            <li key={p.label} className="flex justify-between gap-3 px-4 py-3 text-sm">
              <span className="text-white/90">{p.label}</span>
              <span className="tabular-nums text-emerald-300">${p.owedUsd.toFixed(2)}</span>
            </li>
          ))}
        </ul>
      </section>

      {report.findings.length > 0 && (
        <section className="mt-6">
          <h2 className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
            Evidence
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-resolve-muted">
            {report.findings.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-8 flex flex-wrap gap-3 text-xs text-resolve-muted">
        <span className="inline-flex items-center gap-1">
          <Receipt className="h-3.5 w-3.5" />
          Created {new Date(report.createdAt).toLocaleString()}
        </span>
        <Link href="/capital" className="inline-flex items-center gap-1 text-resolve-accent hover:underline">
          Treasury
          <ExternalLink className="h-3 w-3" />
        </Link>
      </footer>
    </div>
  );
}
