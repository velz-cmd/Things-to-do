"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { Task } from "@/lib/deputy/ui-types";
import { taskEmoji, taskProgress, taskStatusLabel } from "@/lib/resolve/progress";

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);

  const load = useCallback(async () => {
    const res = await fetch("/api/tasks");
    const data = await res.json();
    setTasks(data.tasks ?? []);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 4000);
    return () => clearInterval(interval);
  }, [load]);

  const active = tasks.filter((t) => !["settled", "failed", "refunded"].includes(t.status));
  const done = tasks.filter((t) => ["settled", "failed", "refunded"].includes(t.status));

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6 lg:p-8">
      <header>
        <h1 className="text-2xl font-semibold">Tasks</h1>
        <p className="mt-1 text-deputy-muted">All active and completed outcomes</p>
      </header>

      <section>
        <h2 className="mb-3 text-xs uppercase tracking-wide text-deputy-muted">Active</h2>
        {active.length === 0 ? (
          <p className="text-sm text-deputy-muted">No active missions — assign one from Overview</p>
        ) : (
          <div className="space-y-2">
            {active.map((t) => (
              <MissionRow key={t.id} task={t} />
            ))}
          </div>
        )}
      </section>

      {done.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs uppercase tracking-wide text-deputy-muted">Completed</h2>
          <div className="space-y-2">
            {done.map((t) => (
              <MissionRow key={t.id} task={t} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function MissionRow({ task }: { task: Task }) {
  const pct = taskProgress(task.status);
  const recovered =
    task.status === "settled"
      ? `+$${task.recoveredUsd.toFixed(0)}`
      : task.status === "settled"
        ? "Pending"
        : `Target $${task.targetValueUsd.toFixed(0)}`;

  return (
    <Link
      href={`/tasks/${task.id}`}
      className="flex items-center gap-4 rounded-xl border border-deputy-border bg-deputy-panel p-4 hover:border-deputy-accent/40"
    >
      <span className="text-2xl">{taskEmoji(task.title, task.merchantId)}</span>
      <div className="flex-1 min-w-0">
        <p className="truncate font-medium">{task.title}</p>
        <p className="text-sm text-deputy-muted">
          Status: {taskStatusLabel(task.status)}
        </p>
      </div>
      <div className="text-right">
        <p className="font-mono text-sm text-deputy-accent">{recovered}</p>
        <p className="text-xs text-deputy-muted">{pct}%</p>
      </div>
    </Link>
  );
}
