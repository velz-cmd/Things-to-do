"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { OutcomeSnapshot } from "@/components/resolve/outcome-snapshot";
import { ActiveMissions } from "@/components/resolve/active-missions";
import { SuccessFeed } from "@/components/resolve/success-feed";
import { OutcomeInput } from "@/components/resolve/outcome-input";
import { DemoTimeline } from "@/components/resolve/demo-timeline";
import { BalanceSummary } from "@/components/wallet/balance-summary";
import { AccessGateBanner, AgentEscrowBadge } from "@/components/resolve/access-gate";
import { useResolveAccess } from "@/hooks/use-resolve-access";
import type { DashboardStats, Task } from "@/lib/deputy/ui-types";

export default function OverviewPage() {
  const router = useRouter();
  const { ready } = useResolveAccess();
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
    if (!ready) {
      toast.error("Sign in first", {
        description: "Google or email — then add funds if needed",
      });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not assign task");
      toast.success("Mission assigned", {
        description: "Lock budget on the task page to deploy",
      });
      refresh();
      if (data.task?.id) router.push(`/tasks/${data.task.id}`);
    } catch (e) {
      toast.error("Assignment failed", {
        description: e instanceof Error ? e.message : "Try again",
      });
    } finally {
      setLoading(false);
    }
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

      <OutcomeInput loading={loading} onAssign={assignOutcome} disabled={!ready} />

      <AccessGateBanner />
      <AgentEscrowBadge />

      <BalanceSummary />

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
