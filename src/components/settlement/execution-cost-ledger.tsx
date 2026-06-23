"use client";

import { useEffect, useState } from "react";

type CostRow = {
  id: string;
  agent: string;
  action: string;
  amountUsdc: number;
  meteringMode: string;
  txHash: string | null;
};

export function ExecutionCostLedger({ taskId }: { taskId: string }) {
  const [rows, setRows] = useState<CostRow[]>([]);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/settlement/status/${taskId}`);
      if (!res.ok) return;
      const data = await res.json();
      setRows(data.executionCosts ?? []);
    }
    void load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [taskId]);

  if (rows.length === 0) return null;

  const total = rows.reduce((s, r) => s + r.amountUsdc, 0);

  return (
    <section className="rounded-xl border border-deputy-border bg-deputy-panel p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wide text-deputy-muted">
          Execution cost ledger
        </h2>
        <span className="text-xs text-deputy-muted">offchain_metered</span>
      </div>
      <p className="mt-1 text-[10px] text-deputy-muted">
        Nanopayment-style metering — maps to Circle Gateway later. Not every row is
        an on-chain transaction.
      </p>
      <ul className="mt-3 space-y-1.5">
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between rounded-lg bg-deputy-bg/50 px-3 py-2 text-xs"
          >
            <span className="text-deputy-muted">
              {r.agent}: {r.action}
            </span>
            <span className="font-mono text-deputy-accent">
              ${r.amountUsdc.toFixed(3)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-right text-sm font-medium text-white">
        Total execution: ${total.toFixed(3)}
      </p>
    </section>
  );
}
