"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OutcomeDashboard } from "@/components/deputy/outcome-dashboard";
import { AssignOutcomeBar } from "@/components/deputy/assign-outcome-bar";
import { AgentPipeline } from "@/components/deputy/agent-pipeline";
import { TaskTimeline } from "@/components/deputy/task-timeline";
import { ProofArtifactPanel } from "@/components/deputy/proof-artifact-panel";
import { ArcEscrowCard } from "@/components/deputy/arc-escrow-card";
import { MicroPaymentLog } from "@/components/deputy/micro-payment-log";
import { TaskSidebar } from "@/components/deputy/task-sidebar";
import { StatusBadge } from "@/components/ui";
import type {
  DashboardStats,
  OutcomeTemplate,
  Task,
} from "@/lib/deputy/ui-types";

export default function AppConsolePage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [templates, setTemplates] = useState<OutcomeTemplate[]>([]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);
  const [executionStarted, setExecutionStarted] = useState(false);
  const [demoMode, setDemoMode] = useState(true);

  const refresh = useCallback(async () => {
    const [s, t, c] = await Promise.all([
      fetch("/api/stats").then((r) => r.json()),
      fetch("/api/templates").then((r) => r.json()),
      fetch("/api/config").then((r) => r.json()),
    ]);
    setStats(s);
    setTemplates(t.outcomes ?? []);
    setDemoMode(c.demoMode ?? true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (
      !activeTask ||
      !executionStarted ||
      ["settled", "failed", "refunded"].includes(activeTask.status)
    ) {
      return;
    }
    const interval = setInterval(async () => {
      const res = await fetch(`/api/tasks/${activeTask.id}`);
      const data = await res.json();
      if (data.task) {
        setActiveTask(data.task);
        if (data.task.status === "proof_pending" && demoMode) {
          await fetch("/api/merchant/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              taskId: data.task.id,
              merchantId: data.task.merchantId,
              refundedAmountUsd: data.task.targetValueUsd,
            }),
          });
        }
      }
      refresh();
    }, 1200);
    return () => clearInterval(interval);
  }, [activeTask, executionStarted, refresh, demoMode]);

  async function assignTask(templateId: string) {
    setLoading(true);
    setExecutionStarted(false);
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId, deferExecution: true }),
    });
    const data = await res.json();
    setActiveTask(data.task);
    setLoading(false);
    refresh();
    router.push(`/app/tasks/${data.task.id}`);
  }

  async function startExecution() {
    if (!activeTask) return;
    setExecutionStarted(true);
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "execute", taskId: activeTask.id }),
    });
  }

  return (
    <>
      <aside className="lg:col-span-3">
        <TaskSidebar tasks={stats?.recentTasks ?? []} activeId={activeTask?.id} />
      </aside>

      <main className="space-y-4 lg:col-span-6">
        <OutcomeDashboard stats={stats} />

        {!activeTask ? (
          <AssignOutcomeBar
            templates={templates}
            loading={loading}
            onAssign={assignTask}
          />
        ) : (
          <div className="rounded-xl border border-deputy-border bg-deputy-panel p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase text-deputy-muted">Active outcome</p>
                <p className="font-medium">{activeTask.title}</p>
              </div>
              <StatusBadge status={activeTask.status} />
            </div>

            <div className="mt-4">
              <AgentPipeline activeAgent={activeTask.currentAgent} />
            </div>

            <div className="mt-4">
              <TaskTimeline events={activeTask.events} />
            </div>

            {!executionStarted && activeTask.escrowLocked && (
              <button
                type="button"
                onClick={startExecution}
                className="mt-4 w-full rounded-lg bg-deputy-accent py-2.5 text-sm font-semibold text-deputy-bg"
              >
                Deploy deputy agents
              </button>
            )}
          </div>
        )}
      </main>

      <aside className="space-y-4 lg:col-span-3">
        {activeTask && (
          <>
            <ArcEscrowCard
              task={activeTask}
              onLocked={async () => {
                const res = await fetch(`/api/tasks/${activeTask.id}`);
                const data = await res.json();
                if (data.task) setActiveTask(data.task);
              }}
            />
            <ProofArtifactPanel proofs={activeTask.proofs ?? []} />
            <MicroPaymentLog payments={activeTask.microPayments ?? []} />
          </>
        )}
      </aside>
    </>
  );
}
