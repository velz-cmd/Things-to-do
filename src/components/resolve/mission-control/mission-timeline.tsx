"use client";

import clsx from "clsx";
import type { ServerTimelineEvent } from "@/lib/mission/client-api";

export function MissionTimeline({
  events,
  loading,
}: {
  events: ServerTimelineEvent[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <p className="mt-2 px-2 text-xs text-resolve-muted-dim">Loading timeline…</p>
    );
  }

  if (!events.length) {
    return (
      <p className="mt-2 px-2 text-xs leading-relaxed text-resolve-muted">
        Events from missions, repos, and settlements appear here.
      </p>
    );
  }

  return (
    <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
      {events.slice(0, 12).map((e) => (
        <li
          key={e.id}
          className="rounded-lg px-2.5 py-1.5 text-left transition hover:bg-white/[0.03]"
        >
          <span
            className={clsx(
              "block truncate text-[12px]",
              e.severity === "critical" ? "text-rose-300"
              : e.severity === "watch" ? "text-amber-200"
              : "text-resolve-muted",
            )}
          >
            {e.title}
          </span>
          {e.detail && (
            <span className="mt-0.5 block truncate text-[10px] text-resolve-muted-dim">
              {e.detail}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
