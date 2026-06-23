"use client";

import { useEffect, useState, useCallback } from "react";
import clsx from "clsx";
import Link from "next/link";
import { WalletConnect } from "@/components/wallet-connect";
import { EscrowLock } from "@/components/escrow-lock";
import { DEPUTY_DOCTRINE } from "@/lib/deputy/types";

interface TaskEvent {
  id: string;
  agent: string;
  phase: string;
  message: string;
  createdAt: string;
}

interface Proof {
  id: string;
  type: string;
  source: string;
  contentHash: string;
  verified: boolean;
  payload: string;
}

interface Task {
  id: string;
  title: string;
  status: string;
  targetValueUsd: number;
  recoveredUsd: number;
  executionCostUsd: number;
  successFeeUsd: number;
  budgetUsd: number;
  currentAgent: string | null;
  proofHash: string | null;
  settlementTxHash: string | null;
  escrowTxHash: string | null;
  escrowLocked: boolean;
  merchantId: string | null;
  events: TaskEvent[];
  proofs?: Proof[];
}

interface Template {
  id: string;
  title: string;
  description: string;
  targetValueUsd: number;
  merchantId: string;
}

interface Stats {
  moneyRecoveredUsd: number;
  subscriptionsCancelled: number;
  executionCostUsd: number;
  netGainUsd: number;
  tasksCompleted: number;
  activeTasks: number;
}

const AGENTS = [
  "Planner",
  "Evidence",
  "Executor",
  "Retry",
  "Verification",
  "Escalation",
];

export default function HomePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
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

  const netGain = activeTask
    ? activeTask.recoveredUsd -
      activeTask.executionCostUsd -
      activeTask.successFeeUsd
    : 0;

  const latestProof = activeTask?.proofs?.[activeTask.proofs.length - 1];

  return (
    <div className="min-h-screen bg-deputy-bg text-white">
      <header className="border-b border-deputy-border bg-deputy-panel/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-deputy-muted">
              Lepton · Arc Testnet
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">DEPUTY</h1>
            <p className="text-sm text-deputy-muted">
              Autonomous Outcome Engine — pay only on proof
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/merchant"
              className="text-xs text-deputy-muted underline hover:text-deputy-accent"
            >
              Merchant portal
            </Link>
            <WalletConnect />
            <span className="rounded-full border border-deputy-accent/30 bg-deputy-accent/10 px-3 py-1 text-xs text-deputy-accent">
              Outcome doctrine
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Hero pitch */}
        <section className="mb-8 rounded-2xl border border-deputy-border bg-gradient-to-br from-deputy-panel to-deputy-bg p-6">
          <p className="text-lg font-medium">
            Assign the problem. Come back when it&apos;s solved.
          </p>
          <p className="mt-2 max-w-2xl text-sm text-deputy-muted">
            DEPUTY is not pay-per-token. It is{" "}
            <span className="text-deputy-accent">pay-per-resolution</span>. Arc
            escrow unlocks only when the proof engine verifies the outcome.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.values(DEPUTY_DOCTRINE).map((line) => (
              <span
                key={line.slice(0, 24)}
                className="rounded-full border border-deputy-border bg-deputy-bg/60 px-2.5 py-1 text-xs text-deputy-muted"
              >
                {line.split("—")[0].trim().slice(0, 40)}…
              </span>
            ))}
          </div>
        </section>

        {/* Financial dashboard */}
        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            {
              label: "Money recovered",
              value: `$${(stats?.moneyRecoveredUsd ?? 0).toFixed(2)}`,
              accent: "text-deputy-accent",
            },
            {
              label: "Subscriptions cancelled",
              value: String(stats?.subscriptionsCancelled ?? 0),
              accent: "text-white",
            },
            {
              label: "Execution cost",
              value: `$${(stats?.executionCostUsd ?? 0).toFixed(2)}`,
              accent: "text-deputy-warn",
            },
            {
              label: "Net gain",
              value: `$${(stats?.netGainUsd ?? 0).toFixed(2)}`,
              accent: "text-deputy-accent",
            },
            {
              label: "Tasks completed",
              value: String(stats?.tasksCompleted ?? 0),
              accent: "text-white",
            },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-deputy-border bg-deputy-panel p-4"
            >
              <p className="text-xs uppercase tracking-wide text-deputy-muted">
                {card.label}
              </p>
              <p className={clsx("mt-1 text-2xl font-semibold", card.accent)}>
                {card.value}
              </p>
            </div>
          ))}
        </section>

        <div className="grid gap-6 lg:grid-cols-5">
          <section className="lg:col-span-2">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-deputy-muted">
              Assign outcome
            </h2>
            <div className="space-y-3">
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  disabled={loading}
                  onClick={() => assignTask(t.id)}
                  className="w-full rounded-xl border border-deputy-border bg-deputy-panel p-4 text-left transition hover:border-deputy-accent/50 hover:bg-deputy-panel/80 disabled:opacity-50"
                >
                  <p className="font-medium">{t.title}</p>
                  <p className="mt-1 text-sm text-deputy-muted">{t.description}</p>
                  <p className="mt-2 text-sm text-deputy-accent">
                    Target ${t.targetValueUsd.toFixed(2)} · Success fee $0.20
                  </p>
                </button>
              ))}
            </div>
          </section>

          <section className="lg:col-span-3">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-deputy-muted">
              Operations console
            </h2>
            {!activeTask ? (
              <div className="rounded-xl border border-dashed border-deputy-border p-12 text-center text-deputy-muted">
                Assign a task to watch deputies execute
              </div>
            ) : (
              <div className="rounded-xl border border-deputy-border bg-deputy-panel p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase text-deputy-muted">Outcome</p>
                    <p className="font-medium">{activeTask.title}</p>
                  </div>
                  <StatusBadge status={activeTask.status} />
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Metric
                    label="Target"
                    value={`$${activeTask.targetValueUsd.toFixed(2)}`}
                  />
                  <Metric
                    label="Recovered"
                    value={`$${activeTask.recoveredUsd.toFixed(2)}`}
                  />
                  <Metric
                    label="Deputy cost"
                    value={`$${activeTask.executionCostUsd.toFixed(4)}`}
                  />
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <EscrowLock
                    taskId={activeTask.id}
                    budgetUsd={activeTask.budgetUsd}
                    successFeeUsd={activeTask.successFeeUsd}
                    locked={activeTask.escrowLocked}
                    escrowTxHash={activeTask.escrowTxHash}
                    onLocked={async () => {
                      const res = await fetch(`/api/tasks/${activeTask.id}`);
                      const data = await res.json();
                      if (data.task) setActiveTask(data.task);
                    }}
                  />
                  {!executionStarted && activeTask.escrowLocked && (
                    <button
                      type="button"
                      onClick={startExecution}
                      className="rounded-lg bg-deputy-accent py-2 text-sm font-semibold text-deputy-bg transition hover:opacity-90"
                    >
                      Deploy deputy agents
                    </button>
                  )}
                  {!activeTask.escrowLocked && (
                    <p className="flex items-center text-xs text-deputy-muted">
                      Lock escrow first — deputies execute only after funds are
                      committed
                    </p>
                  )}
                </div>

                {activeTask.status === "settled" && (
                  <div className="mt-4 rounded-lg border border-deputy-accent/30 bg-deputy-accent/10 p-4">
                    <p className="text-lg font-semibold text-deputy-accent">
                      Net gain: +${netGain.toFixed(2)}
                    </p>
                    <p className="mt-1 text-sm text-deputy-muted">
                      Arc escrow released on verified proof
                    </p>
                    {activeTask.settlementTxHash && (
                      <a
                        href={`https://testnet.arcscan.app/tx/${activeTask.settlementTxHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-xs text-deputy-accent underline"
                      >
                        View settlement tx
                      </a>
                    )}
                  </div>
                )}

                {latestProof && (
                  <div className="mt-4 rounded-lg border border-deputy-border bg-deputy-bg/40 p-4">
                    <p className="text-xs uppercase text-deputy-muted">
                      Proof engine
                    </p>
                    <p className="mt-1 text-sm text-deputy-accent">
                      {latestProof.verified ? "VERIFIED" : "PENDING"} —{" "}
                      {latestProof.type.replace(/_/g, " ")}
                    </p>
                    <p className="mt-1 font-mono text-xs text-deputy-muted">
                      {latestProof.contentHash.slice(0, 42)}…
                    </p>
                  </div>
                )}

                <div className="mt-5">
                  <p className="mb-2 text-xs uppercase text-deputy-muted">
                    Agent team
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {AGENTS.map((agent, i) => (
                      <div key={agent} className="flex items-center gap-2">
                        <span
                          className={clsx(
                            "rounded-full px-2.5 py-1 text-xs",
                            activeTask.currentAgent === agent
                              ? "bg-deputy-accent/20 text-deputy-accent ring-1 ring-deputy-accent/40"
                              : "bg-deputy-bg text-deputy-muted"
                          )}
                        >
                          {agent}
                        </span>
                        {i < AGENTS.length - 1 && (
                          <span className="text-deputy-border">→</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-5 max-h-72 overflow-y-auto">
                  <p className="mb-2 text-xs uppercase text-deputy-muted">
                    Timeline
                  </p>
                  <ul className="space-y-2">
                    {activeTask.events.map((ev) => (
                      <li
                        key={ev.id}
                        className="flex gap-3 border-l-2 border-deputy-accent/30 pl-3 text-sm"
                      >
                        <span className="shrink-0 font-mono text-xs text-deputy-accent">
                          {ev.agent}
                        </span>
                        <span className="text-deputy-muted">{ev.message}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    settled: "text-deputy-accent border-deputy-accent/40",
    verified: "text-deputy-accent border-deputy-accent/40",
    failed: "text-deputy-danger border-deputy-danger/40",
    executing: "text-deputy-warn border-deputy-warn/40",
    proof_pending: "text-deputy-warn border-deputy-warn/40",
  };
  return (
    <span
      className={clsx(
        "rounded-full border px-2.5 py-0.5 text-xs uppercase tracking-wide",
        colors[status] ?? "text-deputy-muted border-deputy-border"
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-deputy-bg/60 p-3">
      <p className="text-xs text-deputy-muted">{label}</p>
      <p className="font-mono text-sm">{value}</p>
    </div>
  );
}
