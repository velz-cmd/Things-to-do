"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Activity, Radio } from "lucide-react";
import type { DiscoverActivityItem } from "@/lib/discover/radar";

type RadarResponse = {
  ok: boolean;
  live: boolean;
  activity: DiscoverActivityItem[];
  emptyReason: string | null;
  updatedAt: string;
};

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function DiscoverLiveFeed({ className }: { className?: string }) {
  const [data, setData] = useState<RadarResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () =>
      fetch("/api/discover/radar")
        .then((r) => r.json())
        .then((d: RadarResponse) => setData(d))
        .catch(() => setData(null))
        .finally(() => setLoading(false));

    void load();
    const t = setInterval(() => void load(), 25_000);
    return () => clearInterval(t);
  }, []);

  return (
    <section className={clsx("mb-12", className)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Radio
            className={clsx(
              "h-4 w-4",
              data?.live ? "text-emerald-400" : "text-resolve-muted-dim",
            )}
          />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-accent">
              Live activity
            </p>
            <p className="text-xs text-resolve-muted">
              Real authorizations and community events — no synthetic feed
            </p>
          </div>
        </div>
        {data?.live && (
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-300">
            Live
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-resolve-muted">Connecting to authorization ledger…</p>
      ) : !data?.activity.length ? (
        <div className="rounded-xl border border-dashed border-resolve-border/80 bg-resolve-bg-deep/20 px-5 py-8 text-center">
          <Activity className="mx-auto h-8 w-8 text-resolve-muted-dim" strokeWidth={1.25} />
          <p className="mt-3 text-sm text-resolve-muted">
            {data?.emptyReason ??
              "No live events yet. Install a community and connect sensors to see value flow here."}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-resolve-border/50 rounded-xl border border-resolve-border/60 bg-resolve-bg-deep/25">
          {data.activity.map((item) => (
            <li key={item.id} className="px-4 py-3.5 sm:px-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-white">{item.title}</p>
                    {item.domain && (
                      <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] text-resolve-muted">
                        {item.domain}
                      </span>
                    )}
                    {item.status && (
                      <span className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">
                        {item.status.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-resolve-muted">
                    {item.entityPath ? (
                      <Link href={item.entityPath} className="hover:text-resolve-accent hover:underline">
                        {item.detail}
                      </Link>
                    ) : (
                      item.detail
                    )}
                  </p>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-resolve-muted-dim">
                    {item.evidence}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {item.amountUsd != null && item.amountUsd > 0 && (
                    <p className="text-sm font-semibold tabular-nums text-emerald-300">
                      ${item.amountUsd.toFixed(4)}
                    </p>
                  )}
                  <p className="text-[10px] text-resolve-muted-dim">{formatRelative(item.at)}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
