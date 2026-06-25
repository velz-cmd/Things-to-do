"use client";

import Link from "next/link";
import type { Task } from "@/lib/deputy/ui-types";
import { VerifiedTxLink } from "@/components/settlement/verified-tx-link";

export function ResultCard({ task }: { task: Task }) {
  const netSaving =
    task.category?.includes("subscription")
      ? task.targetValueUsd
      : task.recoveredUsd;
  const executionCost = task.executionCostUsd;
  const agentSpend = (task.microPayments ?? []).filter((m) =>
    m.purpose.includes("x402")
  );
  const gatewaySpend = agentSpend.reduce((s, m) => s + m.amountUsd, 0);

  return (
    <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center">
      <p className="text-sm uppercase tracking-wide text-emerald-400">Done</p>
      <h2 className="mt-2 text-xl font-semibold">{task.title}</h2>

      <div className="mx-auto mt-6 max-w-sm space-y-2 text-left text-sm">
        <Row label="Proof" value="Cancellation / refund confirmation verified" />
        {netSaving > 0 && (
          <Row
            label={task.category?.includes("subscription") ? "Monthly saving" : "Recovered"}
            value={`$${netSaving.toFixed(2)}`}
          />
        )}
        {gatewaySpend > 0 && (
          <Row
            label="Agent spend (x402)"
            value={`$${gatewaySpend.toFixed(3)} USDC`}
          />
        )}
        <Row label="Execution cost" value={`$${executionCost.toFixed(3)}`} />
        <Row
          label="Arc settlement"
          value={task.settlementTxHash ? "Released" : "Recorded off-chain"}
        />
      </div>

      {agentSpend.length > 0 && (
        <ul className="mx-auto mt-4 max-w-sm space-y-1 text-left text-xs text-deputy-muted">
          {agentSpend.map((m) => (
            <li key={m.id} className="flex justify-between gap-2">
              <span>{m.purpose}</span>
              <span className="font-mono text-sky-400">
                ${m.amountUsd.toFixed(3)}
                {m.txHash ? " on-chain" : ""}
              </span>
            </li>
          ))}
        </ul>
      )}

      {task.settlementTxHash && (
        <div className="mt-4 flex justify-center">
          <VerifiedTxLink hash={task.settlementTxHash} />
        </div>
      )}

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href={`/missions?mission=${task.id}`}
          className="rounded-lg border border-deputy-border px-4 py-2 text-sm hover:bg-deputy-panel"
        >
          View proof
        </Link>
        <Link
          href="/"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          Start another task
        </Link>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-deputy-border/40 py-2">
      <span className="text-deputy-muted">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
