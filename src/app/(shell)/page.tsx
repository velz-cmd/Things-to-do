"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OutcomeSnapshot } from "@/components/resolve/outcome-snapshot";
import { ActiveMissions } from "@/components/resolve/active-missions";
import { SuccessFeed } from "@/components/resolve/success-feed";
import { OutcomeInput } from "@/components/resolve/outcome-input";
import { DemoTimeline } from "@/components/resolve/demo-timeline";
import type { DashboardStats, Task } from "@/lib/deputy/ui-types";

export default function OverviewPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const [s, t] = await Promise.all([
      fetch("/api/stats").then((r) => r.json()),
      fetch("/api/tasks").then((r) => r.json()),
    ]);
    setStats(s);
    setTasks(t.tasks ?? []);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  async function assignOutcome(templateId: string) {
    setLoading(true);
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId, deferExecution: true }),
    });
    const data = await res.json();
    setLoading(false);
    refresh();
    if (data.task?.id) router.push(`/tasks/${data.task.id}`);
  }

  const active = tasks.filter(
    (t) => !["settled", "failed", "refunded"].includes(t.status)
  );
  const hasActive = active.length > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6 lg:p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">
          Assign the problem. Return when it&apos;s solved.
        </h1>
        <p className="mt-2 text-deputy-muted">
          Pay only for verified outcomes — not per message, not per token.
        </p>
      </header>

      <OutcomeInput loading={loading} onAssign={assignOutcome} />

      <OutcomeSnapshot stats={stats} />

      {hasActive ? (
        <ActiveMissions tasks={active} />
      ) : (
        <DemoTimeline />
      )}

      <SuccessFeed tasks={tasks.filter((t) => t.status === "settled")} stats={stats} />
    </div>
  );
}
