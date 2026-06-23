import Link from "next/link";
import type { Task } from "@/lib/deputy/ui-types";
import { taskEmoji, taskProgress, taskStatusLabel } from "@/lib/resolve/progress";

export function ActiveMissions({
  tasks,
  basePath = "/missions",
}: {
  tasks: Task[];
  basePath?: string;
}) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-deputy-muted">
        Active missions
      </h2>
      <div className="space-y-2">
        {tasks.map((t) => {
          const pct = taskProgress(t.status);
          return (
            <Link
              key={t.id}
              href={`${basePath}/${t.id}`}
              className="flex items-center gap-4 rounded-xl border border-deputy-border bg-deputy-panel p-4 transition hover:border-deputy-accent/40"
            >
              <span className="text-2xl">{taskEmoji(t.title, t.merchantId)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{t.title}</p>
                <p className="text-sm text-deputy-muted">{taskStatusLabel(t.status)}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-deputy-bg">
                  <div
                    className="h-full rounded-full bg-deputy-accent transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <span className="font-mono text-sm text-deputy-accent">{pct}%</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
