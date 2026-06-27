"use client";

import type { ServerTimelineEvent } from "@/lib/mission/client-api";

export function MissionLiveDelta({ events }: { events: ServerTimelineEvent[] }) {
  if (!events.length) return null;

  return (
    <div className="rounded-lg border border-resolve-accent/20 bg-resolve-accent/5 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-resolve-accent">
        Since you left
      </p>
      <ul className="mt-2 space-y-1">
        {events.slice(0, 5).map((e) => (
          <li key={e.id} className="text-xs text-resolve-muted">
            <span className="text-white/90">{e.title}</span>
            {e.detail && <span className="text-resolve-muted-dim"> — {e.detail}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
