import Link from "next/link";
import type { Task } from "@/lib/deputy/ui-types";
import { StatusBadge } from "@/components/ui";
import clsx from "clsx";

export function TaskSidebar({
  tasks,
  activeId,
}: {
  tasks: Task[];
  activeId?: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-deputy-muted">
        Recent tasks
      </p>
      {tasks.length === 0 ? (
        <p className="text-sm text-deputy-muted">No tasks yet</p>
      ) : (
        tasks.map((t) => (
          <Link
            key={t.id}
            href={`/tasks/${t.id}`}
            className={clsx(
              "block rounded-lg border p-3 text-sm transition",
              activeId === t.id
                ? "border-deputy-accent/50 bg-deputy-accent/5"
                : "border-deputy-border hover:border-deputy-accent/30"
            )}
          >
            <p className="line-clamp-2 font-medium">{t.title}</p>
            <div className="mt-2 flex items-center justify-between">
              <StatusBadge status={t.status} />
              <span className="text-xs text-deputy-accent">
                ${t.targetValueUsd.toFixed(0)}
              </span>
            </div>
          </Link>
        ))
      )}
    </div>
  );
}
