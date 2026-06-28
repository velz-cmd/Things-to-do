"use client";

import { useEffect, useState } from "react";
import { isAddress } from "viem";
import { useAuth } from "@/components/auth/auth-provider";
import { toast } from "sonner";
import clsx from "clsx";

const AMOUNTS = [5, 10, 20];

export function SendFundsModal({
  open,
  suggestedUsd,
  onClose,
}: {
  open: boolean;
  suggestedUsd?: number;
  onClose: () => void;
}) {
  const { refreshBalance, user } = useAuth();
  const [amount, setAmount] = useState(10);
  const [destination, setDestination] = useState("");
  const [loading, setLoading] = useState(false);
  const [availableUsd, setAvailableUsd] = useState(0);

  useEffect(() => {
    if (!open || !user) return;
    void fetch("/api/wallet/balance", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (typeof data?.availableUsd === "number") {
          setAvailableUsd(data.availableUsd);
        }
      })
      .catch(() => {
        /* optional */
      });
  }, [open, user]);

  useEffect(() => {
    if (suggestedUsd) setAmount(suggestedUsd);
  }, [suggestedUsd, open]);

  if (!open) return null;

  async function handleSend() {
    if (!user) {
      toast.error("Sign in first");
      return;
    }
    if (!isAddress(destination)) {
      toast.error("Enter a valid Arc address (0x…)");
      return;
    }
    if (amount <= 0 || amount > availableUsd) {
      toast.error(`Enter an amount up to $${availableUsd.toFixed(2)}`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/wallet/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ destinationAddress: destination, amountUsd: amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      toast.success("USDC sent", { description: data.message });
      await refreshBalance();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl border border-deputy-border bg-deputy-panel p-6">
        <h2 className="text-lg font-semibold">Send USDC</h2>
        <p className="mt-1 text-sm text-deputy-muted">
          Send real USDC from your RESOLVE wallet on Arc testnet.
        </p>

        <p className="mt-4 text-xs text-deputy-muted">
          Available: <span className="text-white">${availableUsd.toFixed(2)}</span>
        </p>

        <p className="mt-5 text-xs uppercase tracking-wide text-deputy-muted">Amount</p>
        <div className="mt-2 flex gap-2">
          {AMOUNTS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAmount(a)}
              disabled={a > availableUsd}
              className={clsx(
                "flex-1 rounded-lg border py-2 text-sm font-medium transition disabled:opacity-40",
                amount === a
                  ? "border-deputy-accent bg-deputy-accent/15 text-deputy-accent"
                  : "border-deputy-border text-deputy-muted hover:border-deputy-accent/30",
              )}
            >
              ${a}
            </button>
          ))}
        </div>
        <input
          type="number"
          min={0.01}
          step={0.01}
          max={availableUsd}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="mt-2 w-full rounded-lg border border-deputy-border bg-black/30 px-3 py-2 text-sm text-white"
        />

        <p className="mt-5 text-xs uppercase tracking-wide text-deputy-muted">To address</p>
        <input
          type="text"
          value={destination}
          onChange={(e) => setDestination(e.target.value.trim())}
          placeholder="0x…"
          className="mt-2 w-full rounded-lg border border-deputy-border bg-black/30 px-3 py-2 font-mono text-sm text-white"
        />

        <button
          type="button"
          disabled={loading || !user || availableUsd <= 0}
          onClick={() => void handleSend()}
          className="mt-5 w-full rounded-xl bg-deputy-accent py-3 font-semibold text-deputy-bg disabled:opacity-50"
        >
          {loading ? "Sending on Arc…" : `Send $${amount.toFixed(2)} USDC`}
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
