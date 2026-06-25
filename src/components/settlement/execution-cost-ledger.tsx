"use client";

import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import { GlassPanel } from "@/components/resolve/ui/glass-panel";
import { StatusChip } from "@/components/resolve/ui/status-chip";

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
  const batched = rows.every((r) => r.meteringMode === "gateway_batched");
  const hasGateway = rows.some((r) => r.meteringMode.includes("gateway"));
  const liveGateway = rows.filter((r) => r.meteringMode === "gateway_live");

  return (
    <GlassPanel className="p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-sky-400" />
          <h2 className="text-sm font-medium text-white">Execution costs</h2>
        </div>
        <StatusChip
          label={batched ? "Gateway batched" : "Metered"}
          variant={batched ? "verified" : "running"}
        />
      </div>
      <p className="mt-1 text-[11px] text-resolve-muted">
        {batched
          ? "Agent micropayments batched for Circle Gateway settlement."
          : liveGateway.length > 0
            ? "Live x402 nanopayments via Circle Gateway on Arc testnet."
            : "Nanopayment-style metering — batches to Gateway when mission settles."}
      </p>
      <ul className="mt-3 space-y-1.5">
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-2 text-xs"
          >
            <span className="text-resolve-muted">
              {r.agent}: {r.action}
              {r.meteringMode === "gateway_live" && (
                <span className="ml-1 text-emerald-400">· live</span>
              )}
            </span>
            <span className="font-mono text-sky-400">
              ${r.amountUsdc.toFixed(3)}
              {r.txHash && (
                <span className="ml-1 text-[10px] text-resolve-muted">tx</span>
              )}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3">
        <p className="text-sm font-medium text-white">Total execution</p>
        <p className="font-mono text-sm text-sky-300">${total.toFixed(3)}</p>
      </div>
      {hasGateway && !batched && (
        <p className="mt-2 text-[10px] text-resolve-muted">
          Settles via Circle Gateway batch on mission completion.
        </p>
      )}
    </GlassPanel>
  );
}
