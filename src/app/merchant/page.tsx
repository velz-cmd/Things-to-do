"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Task {
  id: string;
  title: string;
  status: string;
  targetValueUsd: number;
  merchantId: string | null;
}

export default function MerchantPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [confirming, setConfirming] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/tasks");
    const data = await res.json();
    const pending = (data.tasks ?? []).filter(
      (t: Task) =>
        t.status === "proof_pending" ||
        t.status === "waiting_for_response" ||
        t.status === "retrying"
    );
    setTasks(pending);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 2000);
    return () => clearInterval(interval);
  }, []);

  async function confirmRefund(task: Task) {
    setConfirming(task.id);
    await fetch("/api/merchant/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: task.id,
        merchantId: task.merchantId,
        refundedAmountUsd: task.targetValueUsd,
        confirmationId: `MERCH-${Date.now().toString(36).toUpperCase()}`,
      }),
    });
    setConfirming(null);
    load();
  }

  return (
    <div className="min-h-screen bg-deputy-bg text-white">
      <header className="border-b border-deputy-border bg-deputy-panel/80 px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div>
            <p className="text-xs uppercase text-deputy-muted">Demo merchant</p>
            <h1 className="text-xl font-semibold">SkyDemo / StreamDemo Portal</h1>
          </div>
          <Link href="/" className="text-sm text-deputy-accent underline">
            ← DEPUTY console
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <p className="mb-6 text-sm text-deputy-muted">
          Simulates airline/support confirming a refund. When DEPUTY&apos;s
          verification agent receives proof here, Arc escrow releases on the user
          console.
        </p>

        {tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-deputy-border p-12 text-center text-deputy-muted">
            No pending claims — assign a task on DEPUTY and wait for proof_pending
          </div>
        ) : (
          <ul className="space-y-4">
            {tasks.map((task) => (
              <li
                key={task.id}
                className="rounded-xl border border-deputy-border bg-deputy-panel p-5"
              >
                <p className="font-medium">{task.title}</p>
                <p className="mt-1 text-sm text-deputy-muted">
                  Refund amount: ${task.targetValueUsd.toFixed(2)} · Status:{" "}
                  {task.status}
                </p>
                <button
                  type="button"
                  disabled={confirming === task.id}
                  onClick={() => confirmRefund(task)}
                  className="mt-4 rounded-lg bg-deputy-accent px-4 py-2 text-sm font-semibold text-deputy-bg disabled:opacity-50"
                >
                  {confirming === task.id
                    ? "Confirming…"
                    : "Approve refund & send proof"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
