"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ExternalLink, GitBranch, Receipt } from "lucide-react";
import {
  loadMissionReport,
  listMissionReports,
  type MissionReportRecord,
} from "@/lib/mission/mission-report-store";
import { fetchMissionReportServer } from "@/lib/mission/mission-report-api";
import { diffMissionReceipts } from "@/lib/mission/mission-receipt-diff";
import { Money } from "@/components/resolve/ui/money";
import { formatAgentPrice } from "@/lib/agent/agent-signal-format";
import { ArcTxLink } from "@/components/resolve/ui/arc-tx-link";
import { capitalHandoffFromBlueprint } from "@/lib/mission/mission-handoff";
import type { StoredMissionReceipt } from "@/lib/mission/server/mission-blueprint-receipts";

export function MissionReportView({ reportId }: { reportId: string }) {
  const [report, setReport] = useState<MissionReportRecord | null>(null);
  const [stored, setStored] = useState<StoredMissionReceipt | null>(null);
  const [compareDiff, setCompareDiff] = useState<ReturnType<typeof diffMissionReceipts> | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const server = await fetchMissionReportServer(reportId);
      if (cancelled) return;
      if (server) {
        setStored(server);
        setReport(server.package);
        return;
      }
      setReport(loadMissionReport(reportId));
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [reportId]);

  useEffect(() => {
    if (!report || !stored?.id) return;
    const priorId = stored.id;
    void fetch(`/api/mission/reports/memory?slug=${encodeURIComponent(report.communitySlug)}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then(
        (data: {
          memory?: { receipt?: { id: string } };
        }) => {
          const lastId = data.memory?.receipt?.id;
          if (!lastId || lastId === priorId) {
            const prior = listMissionReports().find(
              (r) =>
                r.communitySlug === report.communitySlug &&
                r.id !== reportId &&
                r.status === "authorized",
            );
            if (prior) setCompareDiff(diffMissionReceipts(prior, report));
            return;
          }
          return fetch(
            `/api/mission/reports/memory?compare=${encodeURIComponent(lastId)},${encodeURIComponent(priorId)}`,
          )
            .then((r) => r.json())
            .then((cmp: { diff?: ReturnType<typeof diffMissionReceipts> }) => {
              if (cmp.diff) setCompareDiff(cmp.diff);
            });
        },
      )
      .catch(() => undefined);
  }, [report, reportId, stored?.id]);

  if (!report) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <p className="text-sm text-resolve-muted">
          Mission receipt not found. Run Simulate → Authorize in Mission to generate one.
        </p>
        <Link href="/mission" className="mt-4 inline-block text-sm text-resolve-accent hover:underline">
          Open Mission
        </Link>
      </div>
    );
  }

  const sim = report.simulation ?? stored?.simulation;
  const settlement = stored?.settlement;
  const evidence = stored?.evidenceLinks ?? [];
  const statusLabel =
    report.status === "authorized"
      ? "Authorized"
      : report.status === "simulated"
        ? "Simulated"
        : "Draft";

  return (
    <div className="mission-report-view mx-auto max-w-4xl px-4 py-10 lg:px-8">
      <Link
        href="/mission"
        className="inline-flex items-center gap-1 text-xs text-resolve-muted hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Mission
      </Link>

      <header className="mt-6 rounded-xl border border-sky-500/25 bg-sky-500/[0.06] p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-300/90">
          Mission decision receipt
        </p>
        <h1 className="mt-2 text-xl font-semibold text-white">{report.objective}</h1>
        <p className="mt-2 text-sm text-resolve-muted">
          {report.communityLabel} · {statusLabel}
          {stored ? " · synced" : " · local copy"}
        </p>
        <div className="mt-4 flex flex-wrap gap-4 text-xs">
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-resolve-muted">
            ID {report.id}
          </span>
          {report.agentSignalUsd > 0 && (
            <span className="text-emerald-300">
              Agent signal {formatAgentPrice(report.agentSignalUsd)}
            </span>
          )}
          {report.policy && <span className="text-resolve-muted">Policy · {report.policy}</span>}
        </div>
      </header>

      {settlement && (
        <section className="mt-6 rounded-xl border border-violet-500/20 bg-violet-500/[0.04] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-200/90">
            Settlement package
          </p>
          <p className="mt-2 text-sm text-resolve-muted">
            Batch <span className="font-mono text-white">{settlement.batchHash}</span> ·{" "}
            {settlement.recipientCount} recipients · ${settlement.totalUsd.toFixed(2)}
          </p>
          <p className="mt-1 font-mono text-[10px] text-resolve-muted-dim">
            {settlement.proofHash}
          </p>
        </section>
      )}

      {sim && (
        <section className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-100">
            <CheckCircle2 className="h-4 w-4" />
            {report.status === "authorized" ? "Decision + money proof" : "Simulation record"}
          </p>
          <ul className="mt-3 space-y-1 text-sm text-resolve-muted">
            <li>{sim.clearedAuthorizations} authorizations in package</li>
            <li>
              <Money amount={sim.totalPayeeUsd} size="sm" className="inline" /> allocated across payees
            </li>
            {sim.checkpointReached && <li>Milestone checkpoint reachable</li>}
            {report.fundTxLabel && <li>{report.fundTxLabel}</li>}
            {stored?.fundTxHash && (
              <li className="flex items-center gap-2">
                Arc <ArcTxLink txHash={stored.fundTxHash} />
              </li>
            )}
          </ul>
        </section>
      )}

      {compareDiff && (
        <section className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-5">
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-amber-200/90">
            <GitBranch className="h-3.5 w-3.5" />
            vs last authorized round
          </p>
          <ul className="mt-2 space-y-1 text-xs text-resolve-muted">
            {compareDiff.policyChanged && <li>Policy changed</li>}
            {compareDiff.budgetDeltaUsd !== 0 && (
              <li>Budget Δ ${compareDiff.budgetDeltaUsd.toFixed(0)}</li>
            )}
            {compareDiff.payeesAdded.length > 0 && (
              <li>Added: {compareDiff.payeesAdded.join(", ")}</li>
            )}
            {compareDiff.payeesRemoved.length > 0 && (
              <li>Removed: {compareDiff.payeesRemoved.join(", ")}</li>
            )}
            {compareDiff.payeesChanged.map((c) => (
              <li key={c.label}>
                {c.label}: ${c.beforeUsd.toFixed(2)} → ${c.afterUsd.toFixed(2)}
              </li>
            ))}
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

      {(evidence.length > 0 || report.findings.length > 0) && (
        <section className="mt-6">
          <h2 className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
            Evidence
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {evidence.map((e) => (
              <li key={e.href}>
                <a
                  href={e.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-resolve-accent hover:underline"
                >
                  {e.label}
                </a>
              </li>
            ))}
            {report.findings.map((f) => (
              <li key={f} className="text-resolve-muted">
                {f}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-8 flex flex-wrap gap-3 text-xs text-resolve-muted">
        <span className="inline-flex items-center gap-1">
          <Receipt className="h-3.5 w-3.5" />
          Created {new Date(report.createdAt).toLocaleString()}
        </span>
        <Link
          href={capitalHandoffFromBlueprint(report)}
          className="inline-flex items-center gap-1 text-resolve-accent hover:underline"
        >
          Capital (prefilled)
          <ExternalLink className="h-3 w-3" />
        </Link>
      </footer>
    </div>
  );
}
