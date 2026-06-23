"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Task } from "@/lib/deputy/ui-types";
import { taskProgress, taskStatusLabel } from "@/lib/resolve/progress";
import { GlassPanel } from "@/components/resolve/ui/glass-panel";
import { StatusChip } from "@/components/resolve/ui/status-chip";

const DEMO_EVENTS = [
  "Receipt found",
  "Policy checked",
  "Portal opened",
  "Cancellation submitted",
  "Confirmation pending",
];

export function LiveMissionPreview() {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((d) => {
        const tasks: Task[] = d.tasks ?? [];
        const active = tasks.find(
          (t) => !["settled", "failed", "refunded", "cancelled"].includes(t.status)
        );
        setTask(active ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <GlassPanel className="p-6">
        <p className="text-sm text-resolve-muted">Loading missions…</p>
      </GlassPanel>
    );
  }

  if (!task) {
    return (
      <GlassPanel className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-resolve-muted">Example mission</p>
            <p className="mt-1 text-lg font-semibold text-white">Cancel StreamDemo Plus</p>
          </div>
          <StatusChip label="Demo mission" variant="demo" />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          <Metric label="Status" value="Claim submitted" />
          <Metric label="Progress" value="76%" />
          <Metric label="Value" value="$12.99/mo" />
          <Metric label="Cost" value="$0.018" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <StatusChip label="Arc escrow: Locked" variant="verified" />
          <StatusChip label="Next: Verify cancellation proof" variant="running" />
        </div>
        <ul className="mt-4 space-y-1.5 border-t border-white/[0.06] pt-4">
          {DEMO_EVENTS.map((e) => (
            <li key={e} className="flex items-center gap-2 text-sm text-resolve-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
              {e}
            </li>
          ))}
        </ul>
        <Link
          href="/start"
          className="mt-5 inline-block text-sm font-medium text-sky-400 hover:text-sky-300"
        >
          Start your own mission →
        </Link>
      </GlassPanel>
    );
  }

  const pct = taskProgress(task.status);

  return (
    <GlassPanel className="p-6" glow>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-resolve-muted">Live mission</p>
          <Link
            href={`/start?mission=${task.id}`}
            className="mt-1 block text-lg font-semibold text-white hover:text-sky-300"
          >
            {task.title}
          </Link>
        </div>
        {task.isDemo && <StatusChip label="Demo mission" variant="demo" />}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-4">
        <Metric label="Status" value={taskStatusLabel(task.status)} />
        <Metric label="Progress" value={`${pct}%`} />
        <Metric label="Value" value={`$${task.targetValueUsd.toFixed(2)}`} />
        <Metric label="Cost" value={`$${task.executionCostUsd.toFixed(3)}`} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <StatusChip
          label={task.escrowLocked ? "Budget: Locked" : "Budget: Not locked"}
          variant={task.escrowLocked ? "verified" : "neutral"}
        />
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-black/40">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <Link
        href={`/start?mission=${task.id}`}
        className="mt-5 inline-block text-sm font-medium text-sky-400 hover:text-sky-300"
      >
        View mission →
      </Link>
    </GlassPanel>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-resolve-muted">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
