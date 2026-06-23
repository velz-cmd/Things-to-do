"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PackageTimeline } from "@/components/resolve/package-timeline";
import { AgentStates } from "@/components/resolve/agent-states";
import { EvidencePanel } from "@/components/resolve/evidence-panel";
import { ArcEscrowCard } from "@/components/deputy/arc-escrow-card";
import { EscrowLock } from "@/components/escrow-lock";
import { ArcNetworkBanner } from "@/components/arc-network-banner";
import { AccessGateBanner, AgentEscrowBadge } from "@/components/resolve/access-gate";
import type { Task } from "@/lib/deputy/ui-types";
import { taskStatusLabel, taskProgress } from "@/lib/resolve/progress";
import { useResolveAccess } from "@/hooks/use-resolve-access";
import { toast } from "sonner";

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [task, setTask] = useState<Task | null>(null);
  const [executionStarted, setExecutionStarted] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const { ready } = useResolveAccess();

  const load = useCallback(async () => {
    const res = await fetch(`/api/tasks/${id}`);
    if (res.status === 401) {
      setTask(null);
      return;
    }
    const data = await res.json();
    setTask(data.task ?? null);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (
      !task ||
      !executionStarted ||
      ["settled", "failed", "refunded"].includes(task.status)
    ) {
      return;
    }
    const interval = setInterval(async () => {
      const res = await fetch(`/api/tasks/${id}`);
      const data = await res.json();
      if (data.task) setTask(data.task);
    }, 2000);
    return () => clearInterval(interval);
  }, [task, executionStarted, id]);

  async function startExecution() {
    if (!ready) {
      toast.error("Sign in and connect wallet first");
      return;
    }
    setDeploying(true);
    setExecutionStarted(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "execute", taskId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Deploy failed");
      toast.success("Mission deployed", {
        description: "Agents are working on your outcome",
      });
      await load();
    } catch (e) {
      toast.error("Deploy failed", {
        description: e instanceof Error ? e.message : "Try again",
      });
      setExecutionStarted(false);
    } finally {
      setDeploying(false);
    }
  }

  if (!task) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-6 lg:p-8">
        <AccessGateBanner />
        <p className="text-deputy-muted">Loading mission…</p>
      </div>
    );
  }

  const confidence = Math.min(94, 70 + taskProgress(task.status) / 5);
  const netGain = task.recoveredUsd - task.executionCostUsd - task.successFeeUsd;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 lg:p-8">
      <Link href="/tasks" className="text-sm text-deputy-accent underline">
        ← Tasks
      </Link>

      <header className="rounded-2xl border border-deputy-border bg-deputy-panel p-6">
        <p className="text-xs uppercase text-deputy-muted">Outcome</p>
        <h1 className="mt-1 text-xl font-semibold">{task.title}</h1>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Expected recovery" value={`$${task.targetValueUsd.toFixed(0)}`} />
          <Stat label="Status" value={taskStatusLabel(task.status)} />
          <Stat label="Confidence" value={`${confidence.toFixed(0)}%`} />
          <Stat label="Cost so far" value={`$${task.executionCostUsd.toFixed(2)}`} />
        </div>
      </header>

      {!task.escrowLocked && (
        <div className="space-y-3 rounded-xl border border-deputy-border bg-deputy-panel p-4">
          <AccessGateBanner />
          <ArcNetworkBanner />
          <AgentEscrowBadge />
          <p className="text-sm text-deputy-muted">Lock task budget to deploy</p>
          <EscrowLock
            taskId={task.id}
            budgetUsd={task.budgetUsd}
            successFeeUsd={task.successFeeUsd}
            locked={false}
            onLocked={load}
          />
        </div>
      )}

      {task.escrowLocked && !executionStarted && !["settled", "failed", "refunded"].includes(task.status) && (
        <button
          type="button"
          disabled={deploying}
          onClick={startExecution}
          className="w-full rounded-xl bg-deputy-accent py-3 font-semibold text-deputy-bg disabled:opacity-50"
        >
          {deploying ? "Deploying…" : "Deploy mission"}
        </button>
      )}

      <PackageTimeline events={task.events} status={task.status} />

      <AgentStates currentAgent={task.currentAgent} status={task.status} />

      <EvidencePanel proofs={task.proofs ?? []} task={task} />

      {task.escrowLocked && (
        <ArcEscrowCard task={task} onLocked={load} />
      )}

      {task.status === "settled" && (
        <div className="rounded-xl border border-deputy-accent/40 bg-deputy-accent/10 p-6 text-center">
          <p className="text-2xl font-semibold text-deputy-accent">
            Recovered ${task.recoveredUsd.toFixed(2)}
          </p>
          <p className="mt-1 text-deputy-muted">Net gain: +${netGain.toFixed(2)}</p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-deputy-muted">{label}</p>
      <p className="mt-0.5 font-mono text-sm font-medium">{value}</p>
    </div>
  );
}
