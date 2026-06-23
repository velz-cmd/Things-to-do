import type { TaskEvent } from "@/lib/deputy/ui-types";

export function TaskTimeline({ events }: { events: TaskEvent[] }) {
  return (
    <div className="max-h-80 overflow-y-auto">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-deputy-muted">
        Timeline
      </p>
      <ul className="space-y-2">
        {events.map((ev) => (
          <li
            key={ev.id}
            className="flex gap-3 border-l-2 border-deputy-accent/30 pl-3 text-sm"
          >
            <span className="shrink-0 font-mono text-xs text-deputy-accent">
              {ev.agent}
            </span>
            <div>
              <p className="text-deputy-muted">{ev.message}</p>
              <p className="font-mono text-[10px] text-deputy-muted/60">
                {new Date(ev.createdAt).toLocaleTimeString()}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
