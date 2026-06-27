"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import type { NetworkIntelligence } from "@/lib/workspace/intelligence";

const RISK_COLORS = {
  critical: "text-rose-300",
  high: "text-orange-300",
  medium: "text-amber-200",
  low: "text-resolve-muted",
} as const;

/** Bloomberg-style economic intelligence — real data only. */
export function IntelligenceBriefing({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const [data, setData] = useState<NetworkIntelligence | null>(null);

  useEffect(() => {
    const load = () =>
      fetch("/api/workspace/overview")
        .then((r) => r.json())
        .then((d) => setData(d.intelligence ?? null));

    void load();
    const t = setInterval(() => void load(), 20_000);
    return () => clearInterval(t);
  }, []);

  if (!data) {
    return (
      <div className={clsx("text-xs text-resolve-muted", className)}>
        Loading network intelligence…
      </div>
    );
  }

  if (compact) {
    return (
      <div className={clsx("flex flex-wrap items-center gap-x-6 gap-y-1 text-xs", className)}>
        <Metric label="Recognized" value={`$${data.recognizedUsd.toFixed(0)}`} />
        <Metric label="Settled" value={`$${data.settledUsd.toFixed(0)}`} />
        <Metric label="Leaking" value={`$${data.leakingUsd.toFixed(0)}`} tone="warning" />
        <Metric label="Sensors" value={String(data.sensorsOnline)} />
      </div>
    );
  }

  return (
    <div className={clsx("space-y-6", className)}>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-muted-dim">
          Network intelligence
        </p>
        <p className="mt-1 text-sm text-white">{data.headline}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Recognized" value={`$${data.recognizedUsd.toFixed(2)}`} />
        <Stat label="Pending funding" value={`$${data.pendingFundingUsd.toFixed(2)}`} />
        <Stat label="Settled" value={`$${data.settledUsd.toFixed(2)}`} />
        <Stat label="Still leaking" value={`$${data.leakingUsd.toFixed(2)}`} accent />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-resolve-muted-dim">
            Top risks
          </p>
          {data.topRisks.length === 0 ? (
            <p className="mt-2 text-xs text-resolve-muted">No critical risks detected yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {data.topRisks.map((r) => (
                <li key={r.label} className="text-xs">
                  <span className={clsx("font-medium", RISK_COLORS[r.level])}>{r.label}</span>
                  <span className="text-resolve-muted"> — {r.detail}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-resolve-muted-dim">
            Signals
          </p>
          <ul className="mt-2 space-y-1.5 text-xs text-resolve-muted">
            <li>{data.opportunitiesTracked} funding opportunities tracked</li>
            <li>{data.criticalGaps} critical funding gaps</li>
            <li>{data.eventsToday} events today</li>
            <li>{data.sensorsOnline} sensors online</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">{label}</p>
      <p className={clsx("mt-1 text-xl font-semibold tabular-nums", accent ? "text-amber-200" : "text-white")}>
        {value}
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warning";
}) {
  return (
    <span className="text-resolve-muted">
      {label}:{" "}
      <span className={clsx("font-medium tabular-nums", tone === "warning" ? "text-amber-200" : "text-white")}>
        {value}
      </span>
    </span>
  );
}
