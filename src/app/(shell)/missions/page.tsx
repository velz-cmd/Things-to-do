"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { Task } from "@/lib/deputy/ui-types";
import { taskEmoji, taskProgress, taskStatusLabel } from "@/lib/resolve/progress";
import {
  getMissingRequiredConnectors,
  nextActionLabel,
} from "@/lib/connectors/connector-service";
import type { ConnectorStatus } from "@/lib/connectors/connector-types";

export default function MissionsPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [connectors, setConnectors] = useState<ConnectorStatus[]>([]);

  const load = useCallback(async () => {
    const [t, c] = await Promise.all([
      fetch("/api/tasks").then((r) => r.json()),
      fetch("/api/connectors/status").then((r) => r.json()),
    ]);
    setTasks(t.tasks ?? []);
    setConnectors(c.connectors ?? []);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 4000);
    return () => clearInterval(interval);
  }, [load]);

  const active = tasks.filter(
    (t) => !["settled", "failed", "refunded", "cancelled"].includes(t.status)
  );
  const done = tasks.filter((t) =>
    ["settled", "failed", "refunded", "cancelled"].includes(t.status)
  );

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-4 lg:p-8">
      <header>
        <h1 className="text-2xl font-semibold">Missions</h1>
        <p className="mt-1 text-sm text-deputy-muted">Active and completed tasks</p>
      </header>

      <section>
        <h2 className="mb-3 text-xs uppercase tracking-wide text-deputy-muted">Active</h2>
        {active.length === 0 ? (
          <p className="text-sm text-deputy-muted">
            No active missions — assign one from Command
          </p>
        ) : (
          <div className="space-y-2">
            {active.map((t) => (
              <MissionCard key={t.id} task={t} connectors={connectors} />
            ))}
          </div>
        )}
      </section>

      {done.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs uppercase tracking-wide text-deputy-muted">Completed</h2>
          <div className="space-y-2">
            {done.map((t) => (
              <MissionCard key={t.id} task={t} connectors={connectors} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function MissionCard({
  task,
  connectors,
}: {
  task: Task;
  connectors: ConnectorStatus[];
}) {
  const pct = taskProgress(task.status);
  const missing = getMissingRequiredConnectors(connectors, task.category ?? "manual");
  const next = nextActionLabel(missing, task);

  return (
    <Link
      href={`/missions/${task.id}`}
      className="block rounded-xl border border-deputy-border bg-deputy-panel p-4 hover:border-blue-500/40"
    >
      <div className="flex items-center gap-4">
        <span className="text-2xl">{taskEmoji(task.title, task.merchantId)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium">{task.title}</p>
            {task.isDemo && (
              <span className="shrink-0 rounded border border-amber-500/30 px-1.5 text-[9px] uppercase text-amber-400">
                Demo
              </span>
            )}
          </div>
          <p className="text-sm text-deputy-muted">{taskStatusLabel(task.status)} · {pct}%</p>
          <p className="mt-1 text-xs text-deputy-muted">
            Target ${task.targetValueUsd.toFixed(0)} · Cost ${task.executionCostUsd.toFixed(3)}
          </p>
          {!["settled", "failed", "refunded", "cancelled"].includes(task.status) && (
            <p className="mt-1 text-xs text-blue-400">Next: {next}</p>
          )}
        </div>
      </div>
    </Link>
  );
}
