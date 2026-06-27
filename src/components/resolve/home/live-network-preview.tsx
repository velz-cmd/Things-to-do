"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BlueGlowCard } from "@/components/resolve/ui/blue-glow-card";
import { MetricCard } from "@/components/resolve/ui/metric-card";
import { Money } from "@/components/resolve/ui/money";

type OverviewLedger = {
  authorizedUsd: number;
  claimableUsd: number;
  settledUsd: number;
  count: number;
};

/** Real network snapshot — no placeholder numbers. */
export function LiveNetworkPreview() {
  const [ledger, setLedger] = useState<OverviewLedger | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/workspace/overview")
      .then((r) => r.json())
      .then((d) => {
        setLedger(d.ledger ?? null);
        setUpdatedAt(d.updatedAt ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  const hasData =
    ledger &&
    (ledger.count > 0 ||
      ledger.authorizedUsd > 0 ||
      ledger.claimableUsd > 0 ||
      ledger.settledUsd > 0);

  return (
    <BlueGlowCard className="relative overflow-hidden p-0" padding={false}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-resolve-border px-6 py-4">
        <p className="text-xs font-medium tracking-wide text-resolve-muted">
          {loading
            ? "Reading network…"
            : updatedAt
              ? `Live · updated ${new Date(updatedAt).toLocaleTimeString()}`
              : "Global value network"}
        </p>
        {ledger && ledger.count > 0 && (
          <span className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            {ledger.count} authorization{ledger.count === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {loading ? (
        <div className="p-10 text-center text-sm text-resolve-muted">Loading live data…</div>
      ) : hasData ? (
        <div className="grid gap-4 p-6 md:grid-cols-3">
          <MetricCard
            label="Recognized"
            value={<Money amount={ledger!.authorizedUsd} size="sm" />}
            hint="Across open ecosystems"
            tone="accent"
          />
          <MetricCard
            label="Claimable"
            value={<Money amount={ledger!.claimableUsd} size="sm" />}
            hint={`${ledger!.count} participant${ledger!.count === 1 ? "" : "s"}`}
            tone="success"
            live={ledger!.claimableUsd > 0}
          />
          <MetricCard
            label="Settled"
            value={<Money amount={ledger!.settledUsd} size="sm" />}
            hint="Arc batches"
            tone="blue"
          />
        </div>
      ) : (
        <div className="p-8 text-center">
          <p className="text-sm text-resolve-muted">
            No value recognized yet. Connect ecosystems where work already happens — RESOLVE
            observes automatically.
          </p>
          <Link
            href="/activity"
            className="mt-4 inline-block text-xs font-semibold text-resolve-accent-bright hover:underline"
          >
            Connect sources →
          </Link>
        </div>
      )}

      <div className="border-t border-resolve-border bg-resolve-bg-deep/40 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-resolve-muted">
            <span className="font-medium text-white">Capital flow OS</span> — discover, allocate,
            settle
          </p>
          <Link
            href="/workspace"
            className="text-xs font-semibold text-resolve-accent-bright transition hover:text-white"
          >
            Open workspace →
          </Link>
        </div>
      </div>
    </BlueGlowCard>
  );
}
