"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Panel } from "@/components/resolve/ui/panel";
import { Money } from "@/components/resolve/ui/money";

type Overview = {
  tagline: string;
  sources: {
    id: string;
    label: string;
    domain: string;
    connected: boolean;
    health: "live" | "waiting" | "soon";
  }[];
  timeline: {
    domain: string;
    label: string;
    authorizationCount: number;
    amountUsd: number;
    reason: string;
  }[];
  ledger: {
    authorizedUsd: number;
    pendingFundingUsd: number;
    claimableUsd: number;
    settledUsd: number;
  } | null;
  treasury: {
    balanceUsd: number;
    obligationsUsd: number;
    claimableUsd: number;
    message: string;
  } | null;
  liveActivity: {
    id: string;
    domain: string;
    eventType: string;
    amountUsd: number;
    status: string;
    context: string;
    at: string;
  }[];
};

function relative(iso: string) {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return "today";
}

export function WorkspaceOsDashboard() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/workspace/overview")
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
    const t = setInterval(() => {
      void fetch("/api/workspace/overview")
        .then((r) => r.json())
        .then((d) => setData(d));
    }, 25_000);
    return () => clearInterval(t);
  }, []);

  if (loading) {
    return <p className="text-sm text-resolve-muted">Loading workspace…</p>;
  }

  if (!data) return null;

  return (
    <div className="space-y-5">
      <Panel className="border-resolve-accent/15 bg-resolve-accent/5 p-4">
        <p className="text-xs uppercase tracking-wide text-resolve-accent">AI watching activity</p>
        <p className="mt-1 text-sm text-white/90">
          Universal events flow through one pipeline — attribution, authorization, settlement.
          Connect sources once; RESOLVE handles the rest.
        </p>
      </Panel>

      <section>
        <h2 className="text-[10px] font-medium uppercase tracking-wider text-resolve-muted">
          Connected sources
        </h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {data.sources.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-lg border border-resolve-border/70 px-3 py-2"
            >
              <span className="text-sm text-white">{s.label}</span>
              <span
                className={clsx(
                  "text-[10px] font-medium uppercase",
                  s.health === "live" ? "text-emerald-300"
                  : s.health === "soon" ? "text-resolve-muted"
                  : "text-amber-300",
                )}
              >
                {s.health === "live" ? "✓" : s.health === "soon" ? "soon" : "connect"}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-[10px] font-medium uppercase tracking-wider text-resolve-muted">
          Today — activity timeline
        </h2>
        {data.timeline.length === 0 ?
          <p className="mt-2 text-sm text-resolve-muted">
            No authorizations yet today. Analyze a source or connect your music library.
          </p>
        : <ul className="mt-2 space-y-3">
            {data.timeline.map((t) => (
              <Panel key={t.domain} className="p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium text-white">{t.label}</p>
                  <p className="text-sm text-emerald-300">
                    +{t.authorizationCount} authorization{t.authorizationCount === 1 ? "" : "s"}
                  </p>
                </div>
                <p className="mt-1 text-xs text-resolve-muted">because {t.reason}</p>
                <p className="mt-2 text-xs text-white/70">
                  <Money amount={t.amountUsd} size="sm" className="inline" /> authorized
                </p>
              </Panel>
            ))}
          </ul>
        }
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Panel className="p-4">
          <p className="text-[10px] uppercase text-resolve-muted">Pending settlement</p>
          <p className="mt-1 text-lg font-semibold text-white">
            <Money
              amount={
                (data.ledger?.authorizedUsd ?? 0) + (data.ledger?.pendingFundingUsd ?? 0)
              }
              size="sm"
            />
          </p>
        </Panel>
        <Panel className="p-4">
          <p className="text-[10px] uppercase text-resolve-muted">Claimable</p>
          <p className="mt-1 text-lg font-semibold text-emerald-300">
            <Money amount={data.ledger?.claimableUsd ?? 0} size="sm" />
          </p>
        </Panel>
      </section>

      <section>
        <h2 className="text-[10px] font-medium uppercase tracking-wider text-resolve-muted">
          Live activity
        </h2>
        <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">
          {data.liveActivity.slice(0, 8).map((a) => (
            <li
              key={a.id}
              className="rounded-md border border-resolve-border/50 px-3 py-2 text-xs"
            >
              <span className="text-resolve-accent">{a.domain}</span>
              <span className="text-resolve-muted"> · </span>
              <span className="text-white/90">{a.context}</span>
              <span className="text-resolve-muted"> → {a.status.replace("_", " ")}</span>
              <span className="float-right text-resolve-muted-dim">{relative(a.at)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
