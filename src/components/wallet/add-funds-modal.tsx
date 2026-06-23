"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { toast } from "sonner";
import clsx from "clsx";

const METHODS = [
  { id: "card" as const, label: "Credit card", icon: "💳" },
  { id: "debit" as const, label: "Debit card", icon: "🏦" },
  { id: "paypal" as const, label: "PayPal", icon: "🅿️" },
  { id: "bank" as const, label: "Bank transfer", icon: "↔️" },
];

const AMOUNTS = [25, 50, 100];

export function AddFundsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { refreshBalance } = useAuth();
  const [method, setMethod] = useState<(typeof METHODS)[number]["id"]>("card");
  const [amount, setAmount] = useState(50);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function handleDeposit() {
    setLoading(true);
    try {
      const res = await fetch("/api/wallet/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountUsd: amount, method }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Deposit failed");
      toast.success("Funds added", {
        description: data.message ?? `$${amount} USDC ready for tasks`,
      });
      await refreshBalance();
      onClose();
    } catch (e) {
      toast.error("Could not add funds", {
        description: e instanceof Error ? e.message : "Try again",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl border border-deputy-border bg-deputy-panel p-6">
        <h2 className="text-lg font-semibold">Add funds</h2>
        <p className="mt-1 text-sm text-deputy-muted">
          Deposits convert to USDC automatically. No bridging required.
        </p>

        <p className="mt-5 text-xs uppercase tracking-wide text-deputy-muted">
          Amount
        </p>
        <div className="mt-2 flex gap-2">
          {AMOUNTS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAmount(a)}
              className={clsx(
                "flex-1 rounded-lg border py-2 text-sm font-medium transition",
                amount === a
                  ? "border-deputy-accent bg-deputy-accent/15 text-deputy-accent"
                  : "border-deputy-border text-deputy-muted hover:border-deputy-accent/30"
              )}
            >
              ${a}
            </button>
          ))}
        </div>

        <p className="mt-5 text-xs uppercase tracking-wide text-deputy-muted">
          Payment method
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {METHODS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMethod(m.id)}
              className={clsx(
                "rounded-lg border px-3 py-2.5 text-left text-sm transition",
                method === m.id
                  ? "border-deputy-accent bg-deputy-accent/10"
                  : "border-deputy-border hover:border-deputy-accent/30"
              )}
            >
              <span className="mr-1">{m.icon}</span> {m.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={handleDeposit}
          className="mt-6 w-full rounded-xl bg-deputy-accent py-3 font-semibold text-deputy-bg disabled:opacity-50"
        >
          {loading ? "Processing…" : `Add $${amount} USDC`}
        </button>

        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="mt-3 w-full text-center text-xs text-deputy-muted underline"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
