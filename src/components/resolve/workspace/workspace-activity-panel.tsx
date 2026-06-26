"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Panel } from "@/components/resolve/ui/panel";
import { domainLabel } from "@/lib/workspace/domains";

type ConnectorPulse = {
  id: string;
  label: string;
  health: string;
  eventsToday: number;
  lastEventAt: string | null;
};

type ActivityItem = {
  id: string;
  message: string;
  at: string;
};

function relative(iso: string) {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  return `${Math.floor(sec / 60)}m ago`;
}

export function WorkspaceActivityPanel({
  phase,
  liveMessages,
}: {
  phase: string;
  liveMessages?: string[];
}) {
  const [connectors, setConnectors] = useState<ConnectorPulse[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  useEffect(() => {
    void fetch("/api/connectors/live")
      .then((r) => r.json())
      .then((d) => setConnectors((d.connectors ?? []).slice(0, 4)));
  }, [phase]);

  useEffect(() => {
    if (liveMessages?.length) {
      setActivity(
        liveMessages.map((m, i) => ({
          id: `live-${i}`,
          message: m,
          at: new Date().toISOString(),
        })),
      );
      return;
    }
    void fetch("/api/authorization/history?limit=8")
      .then((r) => r.json())
      .then((d) => {
        const rows = (d.authorizations ?? []) as {
          id: string;
          connectorId: string;
          contextLabel: string | null;
          status: string;
          updatedAt: string;
        }[];
        setActivity(
          rows.map((r) => ({
            id: r.id,
            message: `${domainLabel(r.connectorId)}: ${r.contextLabel ?? "value recognized"} → ${r.status.replace("_", " ")}`,
            at: r.updatedAt,
          })),
        );
      })
      .catch(() => setActivity([]));
  }, [phase, liveMessages]);

  return (
    <aside className="hidden w-64 shrink-0 xl:block">
      <div className="sticky top-[4.5rem] space-y-4">
        <div>
          <p className="px-1 text-[10px] font-medium uppercase tracking-[0.12em] text-resolve-muted-dim">
            Connected sources
          </p>
          <ul className="mt-2 space-y-2">
            {connectors.map((c) => (
              <Panel key={c.id} variant="glass" className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-white">{c.label}</p>
                  <span
                    className={clsx(
                      "h-2 w-2 rounded-full",
                      c.health === "healthy" ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" : "bg-amber-400",
                    )}
                  />
                </div>
                <p className="mt-1 text-xs text-resolve-muted">
                  {c.eventsToday} events today
                  {c.lastEventAt && ` · ${relative(c.lastEventAt)}`}
                </p>
              </Panel>
            ))}
          </ul>
        </div>

        <div>
          <p className="px-1 text-[10px] font-medium uppercase tracking-[0.12em] text-resolve-muted-dim">
            Activity
          </p>
          <ul className="mt-2 max-h-72 space-y-2 overflow-y-auto">
            {activity.length === 0 ?
              <li className="px-1 text-xs text-resolve-muted-dim">No recent activity</li>
            : activity.map((a) => (
                <li
                  key={a.id}
                  className="rounded-lg border border-resolve-border/60 bg-resolve-raised/40 px-3 py-2.5"
                >
                  <p className="text-xs leading-relaxed text-white/90">{a.message}</p>
                  <p className="mt-1 text-[10px] text-resolve-muted-dim">{relative(a.at)}</p>
                </li>
              ))
            }
          </ul>
        </div>
      </div>
    </aside>
  );
}
