"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Activity, ExternalLink } from "lucide-react";
import type { LiveSettlementRow } from "@/lib/discover/live-settlements";

type LiveSettlementsResponse = {
  ok: boolean;
  live: boolean;
  rows: LiveSettlementRow[];
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

function kindLabel(kind: LiveSettlementRow["kind"]) {
  if (kind === "fund") return "Pool fund";
  if (kind === "settlement") return "Arc batch";
  return "Authorization";
}

/** Phase B — scrolling strip of real DB settlement / fund / authorization rows. */
export function DiscoverLiveArcStrip({ className }: { className?: string }) {
  const [data, setData] = useState<LiveSettlementsResponse | null>(null);
  const dataRef = useRef<LiveSettlementsResponse | null>(null);
  dataRef.current = data;

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/discover/live-settlements?limit=10", { cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as LiveSettlementsResponse;
      if (body.ok) setData(body);
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 45_000);
    return () => clearInterval(timer);
  }, [load]);

  if (!data?.rows.length) {
    return (
      <div
        className={clsx(
          "flex items-center gap-2 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2 text-[11px] text-resolve-muted-dim",
          className,
        )}
      >
        <Activity className="h-3.5 w-3.5 shrink-0 opacity-60" />
        <span>No pool activity on the ledger yet — fulfill a program to fund creators.</span>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "overflow-hidden rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04]",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-emerald-500/15 px-3 py-1.5">
        <Activity className="h-3.5 w-3.5 text-emerald-400" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300/90">
          Live pools
        </span>
        <span className="text-[10px] text-resolve-muted-dim">· real USD + contributor counts</span>
      </div>
      <div className="flex gap-3 overflow-x-auto px-3 py-2 scrollbar-thin">
        {data.rows.map((row) => (
          <div
            key={row.id}
            className="min-w-[220px] shrink-0 rounded-md border border-white/[0.06] bg-black/25 px-2.5 py-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[9px] font-medium uppercase tracking-wide text-resolve-muted-dim">
                {kindLabel(row.kind)}
              </span>
              <span className="text-[9px] text-resolve-muted-dim">{formatRelative(row.at)}</span>
            </div>
            <p className="mt-0.5 line-clamp-2 text-[11px] font-medium leading-snug text-white">
              {row.title}
            </p>
            {row.subline && (
              <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-resolve-muted">
                {row.subline}
              </p>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] tabular-nums">
              <span className="text-emerald-300">${row.amountUsd.toFixed(2)}</span>
              {row.poolBalanceUsd != null && row.kind === "fund" && (
                <span className="text-resolve-muted-dim">
                  pool ${row.poolBalanceUsd.toFixed(0)}
                </span>
              )}
              {row.contributorCount != null && row.contributorCount > 0 && (
                <span className="text-resolve-muted-dim">
                  {row.contributorCount} {row.payeeCategory ?? "contributors"}
                </span>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {row.receiptHref && (
                <Link
                  href={row.receiptHref}
                  className="text-[10px] font-medium text-resolve-accent hover:underline"
                >
                  Proof
                </Link>
              )}
              {row.explorerUrl && (
                <a
                  href={row.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 text-[10px] text-resolve-muted hover:text-white"
                >
                  Arcscan
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
