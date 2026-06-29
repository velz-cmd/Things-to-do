"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Activity, Radio } from "lucide-react";
import type { LiveEventItem } from "@/lib/events/live";

type LiveEventsResponse = {
  ok: boolean;
  live: boolean;
  total: number;
  events: LiveEventItem[];
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

function formatAbsolute(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type LiveEventsListProps = {
  domain?: string | null;
  community?: string | null;
  mission?: string | null;
  status?: string | null;
  scope?: "network" | "mine";
  limit?: number;
  pollMs?: number;
  compact?: boolean;
  title?: string;
  subtitle?: string;
  className?: string;
  emptyMessage?: string;
};

export function LiveEventsList({
  domain,
  community,
  mission,
  status,
  scope,
  limit = 24,
  pollMs = 20_000,
  compact = false,
  title = "Live activity",
  subtitle = "Real authorizations from the ledger — no synthetic feed",
  className,
  emptyMessage,
}: LiveEventsListProps) {
  const [data, setData] = useState<LiveEventsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    if (domain) params.set("domain", domain);
    if (community) params.set("community", community);
    if (mission) params.set("mission", mission);
    if (status) params.set("status", status);
    if (scope) params.set("scope", scope);

    const load = () =>
      fetch(`/api/events/live?${params}`)
        .then((r) => r.json())
        .then((d: LiveEventsResponse) => setData(d))
        .catch(() => setData(null))
        .finally(() => setLoading(false));

    void load();
    const t = setInterval(() => void load(), pollMs);
    return () => clearInterval(t);
  }, [domain, community, mission, status, scope, limit, pollMs]);

  return (
    <section className={clsx(compact ? "space-y-2" : "mb-12", className)}>
      <div className={clsx("flex flex-wrap items-center justify-between gap-2", !compact && "mb-4")}>
        <div className="flex items-center gap-2">
          <Radio
            className={clsx("h-4 w-4", data?.live ? "text-emerald-400" : "text-resolve-muted-dim")}
          />
          <div>
            <p
              className={clsx(
                "font-semibold uppercase tracking-[0.2em] text-resolve-accent",
                compact ? "text-[9px]" : "text-[10px]",
              )}
            >
              {title}
            </p>
            {!compact && <p className="text-xs text-resolve-muted">{subtitle}</p>}
          </div>
        </div>
        {data?.live && data.updatedAt && (
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-300">
            Live · {formatRelative(data.updatedAt)}
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-resolve-muted">Loading ledger events…</p>
      ) : !data?.events.length ? (
        <div
          className={clsx(
            "rounded-xl border border-dashed border-resolve-border/80 bg-resolve-bg-deep/20 text-center",
            compact ? "px-4 py-5" : "px-5 py-8",
          )}
        >
          <Activity
            className={clsx("mx-auto text-resolve-muted-dim", compact ? "h-6 w-6" : "h-8 w-8")}
            strokeWidth={1.25}
          />
          <p className={clsx("mt-3 text-resolve-muted", compact ? "text-xs" : "text-sm")}>
            {emptyMessage ??
              "No events yet. Install a community and connect sensors — value appears here automatically."}
          </p>
        </div>
      ) : (
        <ul
          className={clsx(
            "divide-y divide-resolve-border/50 rounded-xl border border-resolve-border/60 bg-resolve-bg-deep/25",
            compact && "text-xs",
          )}
        >
          {data.events.map((item) => (
            <li key={item.id} className={compact ? "px-3 py-2.5" : "px-4 py-3.5 sm:px-5"}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={clsx("font-medium text-white", compact ? "text-xs" : "text-sm")}>
                      {item.title}
                    </p>
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
                      <Link
                        href={item.entityPath}
                        className="hover:text-resolve-accent hover:underline"
                      >
                        {item.detail}
                      </Link>
                    ) : (
                      item.detail
                    )}
                    {item.communitySlug && (
                      <span className="text-resolve-muted-dim"> · {item.communitySlug}</span>
                    )}
                  </p>
                  {!compact && (
                    <p className="mt-1.5 text-[11px] leading-relaxed text-resolve-muted-dim">
                      {item.evidence}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  {item.amountUsd != null && item.amountUsd > 0 && (
                    <p className="text-sm font-semibold tabular-nums text-emerald-300">
                      ${item.amountUsd.toFixed(4)}
                    </p>
                  )}
                  <p className="text-[10px] text-resolve-muted-dim">
                    {formatAbsolute(item.at)} · {formatRelative(item.at)}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
