"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Money } from "@/components/resolve/ui/money";

type FeedEvent = {
  id: string;
  domain: string;
  eventLabel: string;
  amountUsd: number;
  status: string;
  context: string;
  at: string;
};

function relative(iso: string) {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

/** Bloomberg-style vertical feed — no cards, always moving. */
export function WorkspaceContextFeed({
  className,
  missionLabel,
}: {
  className?: string;
  missionLabel?: string;
}) {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [headline, setHeadline] = useState("");

  useEffect(() => {
    const load = () =>
      fetch("/api/workspace/overview")
        .then((r) => r.json())
        .then((d) => {
          setEvents(d.liveActivity ?? []);
          const recognized = d.ledger?.authorizedUsd ?? 0;
          setHeadline(
            recognized > 0
              ? `$${recognized.toFixed(0)} recognized`
              : "Awaiting sensor events",
          );
        });

    void load();
    const t = setInterval(() => void load(), 15_000);
    return () => clearInterval(t);
  }, []);

  return (
    <aside
      className={clsx(
        "flex h-full min-h-0 flex-col border-l border-resolve-border bg-resolve-bg-deep/30",
        className,
      )}
    >
      <div className="shrink-0 border-b border-resolve-border px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-resolve-muted-dim">
          Live feed
        </p>
        <p className="mt-1 text-sm font-medium text-white">
          {missionLabel ? `Scope: ${missionLabel}` : headline}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {events.length === 0 ? (
          <p className="p-4 text-xs leading-relaxed text-resolve-muted">
            Value events appear here as sensors observe activity.
          </p>
        ) : (
          <ul>
            {events
              .filter((e) =>
                missionLabel
                  ? e.context.toLowerCase().includes(missionLabel.toLowerCase().split("/")[0] ?? "")
                  : true,
              )
              .map((e) => (
              <li
                key={e.id}
                className="border-b border-resolve-border/50 px-4 py-3 text-xs hover:bg-resolve-hover/20"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-resolve-accent">{e.domain}</span>
                  <span className="text-resolve-muted-dim">{relative(e.at)}</span>
                </div>
                <p className="mt-1 text-white/90">
                  {e.eventLabel}
                  <span className="text-resolve-muted"> · {e.context}</span>
                </p>
                <p className="mt-1 text-resolve-muted">
                  <Money amount={e.amountUsd} size="sm" className="inline" />
                  <span className="mx-1">·</span>
                  {e.status.replace("_", " ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="shrink-0 border-t border-resolve-border p-3">
        <Link
          href="/payments"
          className="block text-center text-[11px] font-medium text-resolve-accent hover:underline"
        >
          Treasury & claims →
        </Link>
      </div>
    </aside>
  );
}

/** Full-page value feed for Activity tab. */
export function ValueFeed({ className }: { className?: string }) {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/workspace/overview")
      .then((r) => r.json())
      .then((d) => setEvents(d.liveActivity ?? []))
      .finally(() => setLoading(false));
    const t = setInterval(
      () =>
        void fetch("/api/workspace/overview")
          .then((r) => r.json())
          .then((d) => setEvents(d.liveActivity ?? [])),
      15_000,
    );
    return () => clearInterval(t);
  }, []);

  if (loading) {
    return <p className="py-12 text-center text-sm text-resolve-muted">Loading value graph…</p>;
  }

  if (events.length === 0) {
    return (
      <p className={clsx("py-12 text-center text-sm text-resolve-muted", className)}>
        No events yet. Connect sensors in Profile — value streams here automatically.
      </p>
    );
  }

  return (
    <ul className={clsx("divide-y divide-resolve-border/60", className)}>
      {events.map((e) => (
        <li key={e.id} className="flex gap-4 py-4">
          <span className="w-16 shrink-0 text-[11px] text-resolve-muted-dim">{relative(e.at)}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white">
              <span className="text-resolve-accent">{e.domain}</span>
              {" · "}
              {e.eventLabel}
            </p>
            <p className="mt-0.5 text-xs text-resolve-muted">
              {e.context} · <Money amount={e.amountUsd} size="sm" className="inline" /> ·{" "}
              {e.status.replace("_", " ")}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
