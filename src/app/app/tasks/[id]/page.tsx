"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AgentPipeline } from "@/components/deputy/agent-pipeline";
import { TaskTimeline } from "@/components/deputy/task-timeline";
import { ProofArtifactPanel } from "@/components/deputy/proof-artifact-panel";
import { ArcEscrowCard } from "@/components/deputy/arc-escrow-card";
import { MicroPaymentLog } from "@/components/deputy/micro-payment-log";
import { StatusBadge } from "@/components/ui";
import type { Task } from "@/lib/deputy/ui-types";

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [task, setTask] = useState<Task | null>(null);
  const [executionStarted, setExecutionStarted] = useState(false);
  const [demoMode, setDemoMode] = useState(true);

  const load = useCallback(async () => {
    const [res, cfg] = await Promise.all([
      fetch(`/api/tasks/${id}`),
      fetch("/api/config"),
    ]);
    const data = await res.json();
    setTask(data.task);
    const c = await cfg.json();
    setDemoMode(c.demoMode ?? true);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!task || !executionStarted || ["settled", "failed", "refunded"].includes(task.status)) {
      return;
    }
    const interval = setInterval(async () => {
      const res = await fetch(`/api/tasks/${id}`);
      const data = await res.json();
      if (data.task) {
        setTask(data.task);
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
      load();
    }, 1200);
    return () => clearInterval(interval);
  }, [task, executionStarted, demoMode, id, load]);

  async function startExecution() {
    setExecutionStarted(true);
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "execute", taskId: id }),
    });
  }

  if (!task) {
    return (
      <main className="lg:col-span-12 py-12 text-center text-deputy-muted">
        Loading task…
      </main>
    );
  }

  return (
    <>
      <main className="space-y-4 lg:col-span-8">
        <div className="rounded-xl border border-deputy-border bg-deputy-panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Link href="/app" className="text-xs text-deputy-accent underline">
                ← Console
              </Link>
              <p className="mt-1 font-medium">{task.title}</p>
            </div>
            <StatusBadge status={task.status} />
          </div>
          <div className="mt-4">
            <AgentPipeline activeAgent={task.currentAgent} />
          </div>
          <div className="mt-4">
            <TaskTimeline events={task.events} />
          </div>
          {!executionStarted && task.escrowLocked && (
            <button
              type="button"
              onClick={startExecution}
              className="mt-4 w-full rounded-lg bg-deputy-accent py-2.5 font-semibold text-deputy-bg"
            >
              Deploy deputy agents
            </button>
          )}
        </div>
      </main>
      <aside className="space-y-4 lg:col-span-4">
        <ArcEscrowCard task={task} onLocked={load} />
        <ProofArtifactPanel proofs={task.proofs ?? []} />
        <MicroPaymentLog payments={task.microPayments ?? []} />
      </aside>
    </>
  );
}
