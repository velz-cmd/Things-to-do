"use client";

import { useState } from "react";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import { BlueGlowCard } from "@/components/resolve/ui/blue-glow-card";
import { Button } from "@/components/resolve/ui/button";
import { Money } from "@/components/resolve/ui/money";
import type { MeasureLearnReport } from "@/lib/communities/measure-learn";

const SEV = {
  critical: "border-red-500/30 bg-red-500/10 text-red-200",
  watch: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  positive: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
};

/** Measure → Learn loop on community programs */
export function MeasureLearnPanel({
  slug,
  programId,
  initialReport,
  onUpdated,
}: {
  slug: string;
  programId: string;
  initialReport?: MeasureLearnReport | null;
  onUpdated?: () => void;
}) {
  const [report, setReport] = useState<MeasureLearnReport | null>(initialReport ?? null);
  const [busy, setBusy] = useState(false);

  async function measure() {
    setBusy(true);
    try {
      const res = await fetch(`/api/communities/${slug}/programs/${programId}/rebalance`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Measure failed");
      setReport(data.report);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Measure failed");
    } finally {
      setBusy(false);
    }
  }

  async function learn() {
    setBusy(true);
    try {
      const res = await fetch(`/api/communities/${slug}/programs/${programId}/rebalance`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? data.message ?? "Learn failed");
      setReport(data.report);
      toast.success(data.message);
      onUpdated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Learn failed");
    } finally {
      setBusy(false);
    }
  }

  if (!report) {
    return (
      <BlueGlowCard variant="subtle" className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-white">Measure → Learn</p>
          <p className="mt-1 text-xs text-resolve-muted">
            Close the loop — measure outcomes, rebalance program rules from evidence
          </p>
        </div>
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => void measure()}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Measure"}
        </Button>
      </BlueGlowCard>
    );
  }

  const m = report.metrics;

  return (
    <BlueGlowCard variant="subtle" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-resolve-accent">
            Measure → Learn
          </p>
          <h3 className="mt-1 text-base font-semibold text-white">{report.programName}</h3>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void measure()}>
            <RefreshCw className={clsx("h-3.5 w-3.5", busy && "animate-spin")} />
          </Button>
          <Button size="sm" disabled={busy} onClick={() => void learn()}>
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                Learn & rebalance
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Authorized" value={<Money amount={m.authorizedUsd} size="sm" className="inline" />} />
        <Metric label="Settled" value={<Money amount={m.settledUsd} size="sm" className="inline" />} />
        <Metric label="Plays" value={String(m.playCount)} />
        <Metric label="Settlement rate" value={`${Math.round(m.settlementRate * 100)}%`} />
      </div>

      {report.recommendations.length > 0 && (
        <ul className="space-y-2">
          {report.recommendations.map((r) => (
            <li
              key={r.id}
              className={clsx("rounded-lg border px-3 py-2 text-xs", SEV[r.severity])}
            >
              <span className="font-medium">{r.action}</span>
              <span className="opacity-80"> — {r.reason}</span>
            </li>
          ))}
        </ul>
      )}

      {report.applied && report.appliedChange && (
        <p className="text-xs text-emerald-300">
          Applied: {JSON.stringify(report.appliedChange)}
        </p>
      )}
    </BlueGlowCard>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-resolve-muted">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
