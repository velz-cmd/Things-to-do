"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { Task } from "@/lib/deputy/ui-types";
import { taskEmoji, taskProgress, taskStatusLabel } from "@/lib/resolve/progress";
import { GlassPanel } from "@/components/resolve/ui/glass-panel";
import { PageHeader } from "@/components/resolve/ui/page-header";
import { StatusChip } from "@/components/resolve/ui/status-chip";
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
    <div className="resolve-grid-bg mx-auto max-w-3xl space-y-8 px-4 py-8 lg:px-8">
      <PageHeader title="Missions" subtitle="Track active outcomes." />

      <section>
        <h2 className="mb-3 text-xs uppercase tracking-wide text-deputy-muted">Active</h2>
        {active.length === 0 ? (
          <GlassPanel className="p-8 text-center">
            <p className="text-resolve-muted">No active missions yet.</p>
            <Link href="/start" className="mt-3 inline-block text-sm font-medium text-sky-400 hover:underline">
              Start a task →
            </Link>
          </GlassPanel>
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

  const isActive = !["settled", "failed", "refunded", "cancelled"].includes(task.status);

  return (
    <Link href={`/missions/${task.id}`} className="block">
      <GlassPanel className="p-4 transition hover:border-sky-500/30">
        <div className="flex items-center gap-4">
          <span className="text-2xl">{taskEmoji(task.title, task.merchantId)}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-medium text-white">{task.title}</p>
              {task.isDemo && <StatusChip label="Demo" variant="demo" />}
            </div>
            <p className="mt-1 text-sm text-resolve-muted">
              {taskStatusLabel(task.status)} · {pct}%
            </p>
            <p className="mt-1 text-xs text-resolve-muted">
              Target ${task.targetValueUsd.toFixed(0)} · Cost ${task.executionCostUsd.toFixed(3)}
              {task.escrowLocked ? " · Budget locked" : ""}
            </p>
            {isActive && (
              <p className="mt-1.5 text-xs text-sky-400">Next: {next}</p>
            )}
          </div>
          <div className="hidden h-12 w-12 shrink-0 sm:block">
            <svg className="-rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${pct * 0.94} 100`}
              />
            </svg>
          </div>
        </div>
      </GlassPanel>
    </Link>
  );
}
