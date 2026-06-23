"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { BalanceSummary } from "@/components/wallet/balance-summary";
import { AddFundsModal } from "@/components/wallet/add-funds-modal";
import { useState } from "react";

export default function VaultPage() {
  const { user, balance, refreshBalance } = useAuth();
  const [addFundsOpen, setAddFundsOpen] = useState(false);

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6 lg:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Vault</h1>
          <p className="mt-1 text-deputy-muted">
            Balances, protection, and recovery — settled on Arc USDC
          </p>
        </div>
        {user && (
          <button
            type="button"
            onClick={() => setAddFundsOpen(true)}
            className="rounded-xl bg-deputy-accent px-4 py-2 text-sm font-semibold text-deputy-bg"
          >
            Add funds
          </button>
        )}
      </header>

      <BalanceSummary />

      <section className="rounded-2xl border border-deputy-border bg-deputy-panel p-6">
        <h2 className="text-xs uppercase tracking-wide text-deputy-muted">Guardian</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <GuardRow label="Risk score" value="Low" good />
          <GuardRow label="Suspicious approvals" value="0" good />
          <GuardRow label="Large transfer alerts" value="Enabled" good />
          <GuardRow label="Wallet health" value="98%" good />
        </div>
        <p className="mt-4 text-xs text-deputy-muted">
          Continuous guardian scans run when wallet-protection tasks are active.
        </p>
      </section>

      <section className="rounded-2xl border border-deputy-border bg-deputy-panel p-6">
        <h2 className="text-xs uppercase tracking-wide text-deputy-muted">
          Recent activity
        </h2>
        {balance?.recentActivity?.length ? (
          <ul className="mt-4 space-y-2">
            {balance.recentActivity.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between rounded-lg bg-deputy-bg/60 px-4 py-3 text-sm"
              >
                <span className="text-deputy-muted">
                  {item.label ?? item.type}
                </span>
                <span className="font-mono text-deputy-accent">
                  {item.type === "deposit" ? "+" : ""}$
                  {item.amountUsd.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-deputy-muted">
            No activity yet. Add funds or assign a task to get started.
          </p>
        )}
      </section>

      <AddFundsModal open={addFundsOpen} onClose={() => {
        setAddFundsOpen(false);
        void refreshBalance();
      }} />
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
