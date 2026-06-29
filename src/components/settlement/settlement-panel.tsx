"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { toast } from "sonner";
import type { SettlementRecord } from "@/lib/settlement/settlement-types";

type TxRow = {
  label: string;
  hash?: string;
  status: string;
};

function txRows(s: SettlementRecord): TxRow[] {
  return [
    { label: "Create job", hash: s.createJobTxHash, status: statusFor(s.createJobTxHash, s.mode) },
    { label: "Approve USDC", hash: s.approveTxHash, status: statusFor(s.approveTxHash, s.mode) },
    { label: "Fund escrow", hash: s.fundTxHash, status: statusFor(s.fundTxHash, s.mode) },
    { label: "Submit proof", hash: s.submitProofTxHash, status: statusFor(s.submitProofTxHash, s.mode) },
    { label: "Release", hash: s.releaseTxHash, status: statusFor(s.releaseTxHash, s.mode) },
    { label: "Refund", hash: s.refundTxHash, status: statusFor(s.refundTxHash, s.mode) },
  ].filter((r) => r.hash || s.mode === "mock_arc");
}

function statusFor(hash: string | undefined, mode: SettlementRecord["mode"]) {
  if (!hash) {
    return mode === "mock_arc" ? "Not submitted (mock)" : "Not submitted";
  }
  return "Verify on load";
}

export function SettlementPanel({
  taskId,
  budgetUsd,
  onUpdated,
}: {
  taskId: string;
  budgetUsd: number;
  onUpdated?: () => void;
}) {
  const [settlement, setSettlement] = useState<SettlementRecord | null>(null);
  const [blockers, setBlockers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch(`/api/settlement/status/${taskId}`);
    if (!res.ok) return;
    const data = await res.json();
    setSettlement(data.settlement);
    setBlockers(data.blockers ?? []);

    const rows = txRows(data.settlement);
    const statuses: Record<string, string> = {};
    for (const row of rows) {
      if (!row.hash) {
        statuses[row.label] = row.status;
        continue;
      }
      const v = await fetch(`/api/settlement/verify-tx/${row.hash}`).then((r) =>
        r.json()
      );
      statuses[row.label] = v.verification?.found
        ? v.verification.success
          ? "RPC confirmed"
          : "Failed on Arc"
        : "Pending / not indexed";
    }
    setTxStatus(statuses);
  }, [taskId]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [load]);

  async function lockArcEscrow() {
    setLoading(true);
    try {
      const res = await fetch("/api/settlement/create-escrow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? data.settlement?.error ?? "Escrow failed");
      }
      toast.success(
        data.mode === "live_arc" ? "Task budget locked" : "Budget recorded in ledger",
        { description: data.message }
      );
      await load();
      onUpdated?.();
    } catch (e) {
      toast.error("Could not lock task budget", {
        description: e instanceof Error ? e.message : "Try again",
      });
    } finally {
      setLoading(false);
    }
  }

  if (!settlement) {
    return (
      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 backdrop-blur-sm">
        <p className="text-sm text-resolve-muted">Loading settlement status…</p>
      </section>
    );
  }

  const isLive = settlement.mode === "live_arc";
  const rows = txRows(settlement);

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-transparent p-5 backdrop-blur-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Proof-based payment</h2>
          <p className="mt-1 text-xs text-resolve-muted">
            Your task budget stays locked until verified proof exists.
            {isLive ? " Settled on Arc." : " Configure Arc credentials to settle on-chain."}
          </p>
        </div>
        <span
          className={clsx(
            "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
            isLive
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-amber-500/30 bg-amber-500/10 text-amber-300"
          )}
        >
          {isLive ? "Live on Arc" : "Ledger record"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Stat label="Status" value={settlement.status.replace(/_/g, " ")} />
        <Stat label="Budget" value={`$${budgetUsd.toFixed(2)} USDC`} />
        <Stat label="Job ID" value={settlement.jobId ?? "—"} />
      </div>

      {!isLive && blockers.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-100">
          <p className="font-medium">To enable live settlement:</p>
          <ul className="mt-1 list-inside list-disc">
            {blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      {settlement.error && (
        <p className="mt-3 text-xs text-red-400">{settlement.error}</p>
      )}

      {settlement.status === "not_started" && (
        <button
          type="button"
          disabled={loading}
          onClick={lockArcEscrow}
          className="mt-4 w-full rounded-md bg-resolve-accent py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {loading ? "Locking task budget…" : `Lock $${budgetUsd.toFixed(2)} task budget`}
        </button>
      )}

      {rows.length > 0 && settlement.status !== "not_started" && (
        <div className="mt-4 space-y-2">
          <p className="text-xs uppercase tracking-wide text-deputy-muted">
            On-chain trail
          </p>
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-deputy-bg/50 px-3 py-2 text-xs"
            >
              <span className="text-deputy-muted">{row.label}</span>
              <span className="text-slate-300">
                {txStatus[row.label] ?? row.status}
              </span>
              {row.hash && txStatus[row.label] === "RPC confirmed" ? (
                <a
                  href={`https://testnet.arcscan.app/tx/${row.hash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-deputy-accent underline"
                >
                  {row.hash.slice(0, 10)}…
                </a>
              ) : row.hash ? (
                <span className="font-mono text-deputy-muted">
                  {row.hash.slice(0, 10)}…
                </span>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-deputy-bg/50 px-3 py-2">
      <p className="text-[10px] uppercase text-deputy-muted">{label}</p>
      <p className="mt-0.5 text-sm font-medium capitalize text-white">{value}</p>
    </div>
  );
}
