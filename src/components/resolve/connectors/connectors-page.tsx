"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ExternalLink, RefreshCw } from "lucide-react";
import { Panel } from "@/components/resolve/ui/panel";
import { Money } from "@/components/resolve/ui/money";

type ConnectorLive = {
  id: string;
  label: string;
  description: string;
  catalogStatus: string;
  installed: boolean;
  health: "healthy" | "waiting" | "offline" | "upcoming";
  eventsToday: number;
  authorizationVolumeUsd: number;
  authorizationCount: number;
  lastEventAt: string | null;
  docsPath: string | null;
};

function formatRelative(iso: string | null) {
  if (!iso) return "No events yet";
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

function healthLabel(h: ConnectorLive["health"]) {
  if (h === "healthy") return "Healthy";
  if (h === "waiting") return "Waiting for events";
  if (h === "offline") return "Not configured";
  return "Coming soon";
}

function healthClass(h: ConnectorLive["health"]) {
  if (h === "healthy") return "text-emerald-300 bg-emerald-500/15";
  if (h === "waiting") return "text-amber-300 bg-amber-500/15";
  if (h === "offline") return "text-rose-300 bg-rose-500/15";
  return "text-resolve-muted bg-white/5";
}

export function ConnectorsPage({ embedded = false }: { embedded?: boolean }) {
  const [connectors, setConnectors] = useState<ConnectorLive[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/connectors/live");
      const data = await res.json();
      setConnectors(data.connectors ?? []);
      setUpdatedAt(data.updatedAt ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 15_000);
    return () => clearInterval(t);
  }, [load]);

  const liveCount = connectors.filter((c) => c.catalogStatus === "live").length;
  const eventsToday = connectors.reduce((s, c) => s + c.eventsToday, 0);

  const content = (
    <>
      {!embedded && (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-white">Connectors</h1>
            <p className="mt-1 text-sm text-resolve-muted">
              Where value enters RESOLVE — live status from real events.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void load();
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-resolve-border px-3 py-1.5 text-xs text-resolve-muted hover:text-white"
          >
            <RefreshCw className={clsx("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </button>
        </div>
      )}

      {embedded && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Connector management</h2>
            <p className="mt-1 text-xs text-resolve-muted">
              Install, monitor, and troubleshoot value sources.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void load();
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-resolve-border px-3 py-1.5 text-xs text-resolve-muted hover:text-white"
          >
            <RefreshCw className={clsx("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Live connectors" value={String(liveCount)} />
        <StatCard label="Events today" value={String(eventsToday)} live />
        <StatCard
          label="Last sync"
          value={updatedAt ? formatRelative(updatedAt) : "—"}
          live
        />
      </div>

      <div className="space-y-3">
        {connectors.map((c) => (
          <Panel key={c.id} className="p-0 overflow-hidden">
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-white">{c.label}</h2>
                  <span
                    className={clsx(
                      "rounded px-2 py-0.5 text-[10px] font-medium uppercase",
                      healthClass(c.health),
                    )}
                  >
                    {healthLabel(c.health)}
                  </span>
                  {c.installed && (
                    <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-resolve-muted">
                      Active
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-resolve-muted">{c.description}</p>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <MiniStat label="Events today" value={String(c.eventsToday)} />
                  <MiniStat
                    label="Authorizations"
                    value={String(c.authorizationCount)}
                  />
                  <MiniStat
                    label="Volume"
                    value={<Money amount={c.authorizationVolumeUsd} size="sm" />}
                  />
                  <MiniStat label="Last event" value={formatRelative(c.lastEventAt)} />
                </div>
              </div>

              <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                {c.id === "github" && (
                  <Link
                    href="/workspace/fund"
                    className="rounded-md bg-resolve-accent px-4 py-2 text-center text-sm font-semibold text-white hover:bg-blue-500"
                  >
                    Fund a project
                  </Link>
                )}
                {c.id === "navidrome" && (
                  <>
                    <p className="max-w-xs text-right text-xs text-resolve-muted">
                      Run <code className="text-[10px] text-white/80">scripts/navidrome-bridge.ts</code> on
                      your Navidrome server
                    </p>
                    {c.docsPath && (
                      <a
                        href={c.docsPath}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-resolve-border px-4 py-2 text-sm text-white hover:bg-resolve-hover"
                      >
                        Sync API
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </>
                )}
                {c.catalogStatus === "upcoming" && (
                  <span className="text-xs text-resolve-muted-dim">Not available yet</span>
                )}
              </div>
            </div>
          </Panel>
        ))}
      </div>

      <Panel className="border-resolve-border/60 bg-resolve-bg/40 p-4">
        <p className="text-sm text-resolve-muted">
          Connectors emit normalized events into the Authorization Ledger. Install more sources as
          they ship — the Settlement Core stays the same.
        </p>
        <Link href="/workspace/fund" className="mt-2 inline-block text-sm text-resolve-accent hover:underline">
          Fund a project →
        </Link>
      </Panel>
    </>
  );

  if (embedded) {
    return <div className="space-y-6">{content}</div>;
  }

  return <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">{content}</div>;
}

function StatCard({
  label,
  value,
  live,
}: {
  label: string;
  value: string;
  live?: boolean;
}) {
  return (
    <Panel className="p-4">
      <p className="text-[10px] uppercase tracking-wider text-resolve-muted">{label}</p>
      <p className="mt-1 flex items-center gap-2 text-xl font-semibold text-white">
        {live && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
        )}
        {value}
      </p>
    </Panel>
  );
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-resolve-muted-dim">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-white">{value}</p>
    </div>
  );
}
