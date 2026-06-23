"use client";

import clsx from "clsx";
import type { HumanTimelineItem } from "@/lib/tasks/timeline-humanize";

export function HumanTimeline({ items }: { items: HumanTimelineItem[] }) {
  return (
    <section className="rounded-xl border border-deputy-border bg-deputy-panel/80 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-deputy-muted">
        Timeline
      </p>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className={clsx(
              "flex items-start gap-3 rounded-lg px-2 py-1.5 text-sm",
              item.state === "now" && "bg-amber-500/10 text-amber-100",
              item.state === "next" && "text-deputy-muted",
              item.state === "done" && "text-white/80"
            )}
          >
            <span className="mt-0.5 w-14 shrink-0 text-[10px] font-semibold uppercase tracking-wide">
              {item.state === "now" ? "Now" : item.state === "next" ? "Next" : "Done"}
            </span>
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
