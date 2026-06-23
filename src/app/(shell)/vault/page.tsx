"use client";

import { useEffect, useState } from "react";
import type { Task } from "@/lib/deputy/ui-types";

export default function VaultPage() {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((d) => setTasks(d.tasks ?? []));
  }, []);

  const locked = tasks
    .filter((t) => t.escrowLocked && !["settled", "refunded", "failed"].includes(t.status))
    .reduce((s, t) => s + t.budgetUsd, 0);

  const released = tasks
    .filter((t) => t.status === "settled")
    .reduce((s, t) => s + t.recoveredUsd, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6 lg:p-8">
      <header>
        <h1 className="text-2xl font-semibold">Vault</h1>
        <p className="mt-1 text-deputy-muted">
          Smart budgets, protection, and recovery — not a wallet page
        </p>
      </header>

      <section className="rounded-2xl border border-deputy-border bg-deputy-panel p-6">
        <h2 className="text-xs uppercase tracking-wide text-deputy-muted">Smart budget</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <VaultStat label="USDC in tasks" value={`$${locked.toFixed(2)}`} sub="Locked" />
          <VaultStat label="Released payouts" value={`$${released.toFixed(2)}`} sub="On proof" />
          <VaultStat label="Active escrows" value={String(tasks.filter((t) => t.escrowLocked && t.status !== "settled").length)} sub="Missions" />
        </div>
        <p className="mt-4 text-xs text-deputy-muted">
          Funds lock on Arc testnet. Success fee releases only when proof is verified.
        </p>
      </section>

      <section className="rounded-2xl border border-deputy-border bg-deputy-panel p-6">
        <h2 className="text-xs uppercase tracking-wide text-deputy-muted">Guardian</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <GuardRow label="Risk score" value="Low" good />
          <GuardRow label="Suspicious approvals" value="0" good />
          <GuardRow label="Large transfer alerts" value="Enabled" good />
          <GuardRow label="Wallet health" value="98%" good />
        </div>
        <p className="mt-4 text-xs text-deputy-muted">Full guardian scans — coming soon on Vault</p>
      </section>

      <section className="rounded-2xl border border-deputy-border bg-deputy-panel p-6">
        <h2 className="text-xs uppercase tracking-wide text-deputy-muted">Recovery detective</h2>
        <p className="mt-2 text-sm text-deputy-muted">Find forgotten value across chains</p>
        <div className="mt-4 space-y-2">
          {[
            { label: "Unclaimed airdrops", amount: "$127", soon: true },
            { label: "Staking rewards", amount: "$48", soon: true },
            { label: "Dust assets", amount: "$12", soon: true },
            { label: "Forgotten USDC", amount: "$76", soon: true },
          ].map((r) => (
            <div
              key={r.label}
              className="flex items-center justify-between rounded-lg bg-deputy-bg/60 px-4 py-3 opacity-60"
            >
              <span>{r.label}</span>
              <span className="font-mono text-deputy-accent">{r.amount}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-deputy-muted">Scan & recover — next sprint</p>
      </section>
    </div>
  );
}

function VaultStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl bg-deputy-bg/60 p-4">
      <p className="text-xs text-deputy-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-deputy-accent">{value}</p>
      <p className="text-xs text-deputy-muted">{sub}</p>
    </div>
  );
}

function GuardRow({
  label,
  value,
  good,
}: {
  label: string;
  value: string;
  good?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-deputy-bg/60 px-4 py-3">
      <span className="text-sm text-deputy-muted">{label}</span>
      <span className={good ? "text-deputy-accent" : "text-deputy-warn"}>{value}</span>
    </div>
  );
}
