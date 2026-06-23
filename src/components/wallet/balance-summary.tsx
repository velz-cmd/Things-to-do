"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { useAccount } from "wagmi";
import clsx from "clsx";

export function BalanceSummary({ className }: { className?: string }) {
  const { balance, balanceLoading, user } = useAuth();
  const { isConnected } = useAccount();

  const show =
    user || isConnected || (balance && balance.availableUsd > 0);

  if (!show && !balanceLoading) return null;

  const available = balance?.availableUsd ?? 0;
  const locked = balance?.lockedUsd ?? 0;
  const released = balance?.releasedUsd ?? 0;

  return (
    <section
      className={clsx(
        "rounded-2xl border border-deputy-border bg-deputy-panel p-5",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wide text-deputy-muted">
          Your balance
        </h2>
        {balanceLoading && (
          <span className="text-xs text-deputy-muted">Updating…</span>
        )}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Available balance" value={`$${available.toFixed(2)}`} sub="USDC" />
        <Stat label="Locked in tasks" value={`$${locked.toFixed(2)}`} sub="Task budgets" />
        <Stat label="Released payouts" value={`$${released.toFixed(2)}`} sub="On proof" />
        <Stat
          label="Task budget"
          value={`$${(available + locked).toFixed(2)}`}
          sub="Total allocated"
        />
      </div>
    </section>
  );
}

function Stat({
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
      <p className="mt-1 text-xl font-semibold text-deputy-accent">{value}</p>
      <p className="text-[10px] text-deputy-muted">{sub}</p>
    </div>
  );
}
