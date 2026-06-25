"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Panel } from "@/components/resolve/ui/panel";
import type { HiddenBuilder } from "@/lib/weight/types";

type LogEntry = { ts: string; level: string; domain: string; message: string };

const LEVEL_COLOR: Record<string, string> = {
  SCAN: "text-cyan-400",
  FLAG: "text-amber-300",
  OK: "text-emerald-400",
  ERR: "text-red-400",
};

export default function DiscoverPage() {
  const [builders, setBuilders] = useState<HiddenBuilder[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/discover/builders")
      .then((r) => r.json())
      .then((d) => setBuilders(d.builders ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const poll = () => {
      void fetch("/api/discover/agent-log?limit=24")
        .then((r) => r.json())
        .then((d) => setLog(d.events ?? []));
    };
    poll();
    const id = setInterval(poll, 10000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header>
        <p className="text-[11px] font-medium uppercase tracking-wider text-resolve-muted">
          Discovery agent · live
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-white">
          Find who should be paid
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-resolve-muted">
          Not a payment rail. A discovery engine — the agent scans GitHub, Navidrome, Mastodon,
          and Immich for unpaid value, assigns an <strong className="font-medium text-white">Impact Score</strong>,
          then you weight and settle on Arc.
        </p>
      </header>

      <Panel className="overflow-hidden p-0 font-mono text-[11px]">
        <div className="flex items-center justify-between border-b border-resolve-border px-3 py-2">
          <p className="text-resolve-muted">
            resolve-discovery@arc-testnet · last {log.length} events
          </p>
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            LIVE
          </span>
        </div>
        <ul className="max-h-48 overflow-y-auto px-3 py-2">
          {log.map((e, i) => (
            <li key={`${e.ts}-${i}`} className="flex gap-2 py-0.5 text-resolve-muted">
              <span className="shrink-0 text-resolve-muted-dim">[{e.ts}]</span>
              <span className={`shrink-0 font-semibold ${LEVEL_COLOR[e.level] ?? ""}`}>
                {e.level}
              </span>
              <span className="shrink-0 text-resolve-muted-dim">{e.domain}</span>
              <span className="text-white/90">{e.message}</span>
            </li>
          ))}
        </ul>
      </Panel>

      {loading ? (
        <p className="text-sm text-resolve-muted">Ranking flagged builders…</p>
      ) : (
        <ul className="space-y-3">
          {builders.map((b) => (
            <li key={b.id}>
              <Panel className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-white">{b.name}</p>
                      <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-200">
                        FLAGGED
                      </span>
                      <span className="rounded bg-resolve-hover px-1.5 py-0.5 text-[10px] text-resolve-muted">
                        {b.platform}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-blue-200">{b.headline}</p>
                    <p className="mt-1 text-xs text-resolve-muted">
                      {b.role} · {b.handle}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold tabular-nums text-white">{b.impactScore}</p>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-resolve-muted">
                      Impact score
                    </p>
                    <p className="mt-1 text-xs text-amber-300/90">
                      ~${b.unpaidUsdEstimate.toLocaleString()} unpaid
                    </p>
                  </div>
                </div>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {b.signals.map((s) => (
                    <li
                      key={s.label}
                      className="rounded border border-resolve-border bg-resolve-bg/60 px-2 py-1.5 text-[11px]"
                    >
                      <span className="text-resolve-muted">{s.label}</span>
                      <p className="font-medium text-white">{s.value}</p>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/missions?panel=distribute&builder=${b.id}`}
                    className="inline-flex items-center gap-1 rounded-md bg-resolve-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
                  >
                    Weight &amp; settle
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                  <Link
                    href="/methodology"
                    className="inline-flex items-center gap-1 rounded-md border border-resolve-border px-3 py-1.5 text-xs text-resolve-muted hover:text-white"
                  >
                    Signal methodology
                  </Link>
                </div>
              </Panel>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
