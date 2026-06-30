"use client";

import { useState } from "react";
import { Loader2, TrendingUp } from "lucide-react";
import { Button } from "@/components/resolve/ui/button";
import { Money } from "@/components/resolve/ui/money";

type SimResult = {
  creatorsPaidUsd: number;
  funderRepaidUsd: number;
  communitySurplusUsd: number;
  funderRemainingCapUsd: number;
  capReached: boolean;
};

export function RepaymentSimulatorPanel() {
  const [principal, setPrincipal] = useState("1000");
  const [inflow, setInflow] = useState("2000");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimResult | null>(null);

  async function simulate() {
    setLoading(true);
    try {
      const principalUsd = Number(principal);
      const totalInflow = Number(inflow);
      const res = await fetch("/api/economy/repayment/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          principalUsd,
          immediateCreatorPayoutUsd: principalUsd * 0.85,
          futureInflowsUsd: [totalInflow * 0.3, totalInflow * 0.4, totalInflow * 0.3],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Simulation failed");
      setResult(data.result as SimResult);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-emerald-300" />
        <p className="text-sm font-semibold text-white">Repayment waterfall simulator</p>
      </div>
      <p className="mt-1 text-xs text-resolve-muted">
        Seed capital now — creators paid immediately; funders receive capped payback from future
        inflows (15% default, 1.5× cap).
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-[10px] uppercase text-resolve-muted-dim">Principal ($)</label>
          <input
            type="number"
            value={principal}
            onChange={(e) => setPrincipal(e.target.value)}
            className="mt-1 w-28 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase text-resolve-muted-dim">Projected inflow ($)</label>
          <input
            type="number"
            value={inflow}
            onChange={(e) => setInflow(e.target.value)}
            className="mt-1 w-28 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
          />
        </div>
        <Button size="sm" onClick={() => void simulate()} disabled={loading}>
          {loading ?
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : "Simulate"}
        </Button>
      </div>

      {result && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Creators paid" amount={result.creatorsPaidUsd} />
          <Stat label="Funder repayment" amount={result.funderRepaidUsd} />
          <Stat label="Community surplus" amount={result.communitySurplusUsd} />
          <div>
            <p className="text-[10px] uppercase text-resolve-muted-dim">Cap status</p>
            <p className="mt-1 text-sm font-medium text-white">
              {result.capReached ? "Cap reached" : "Under cap"}
            </p>
            <p className="text-[10px] text-resolve-muted">
              Remaining{" "}
              <Money amount={result.funderRemainingCapUsd} size="sm" className="inline" />
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, amount }: { label: string; amount: number }) {
  return (
    <div>
      <p className="text-[10px] uppercase text-resolve-muted-dim">{label}</p>
      <p className="mt-1 text-sm font-medium text-white">
        <Money amount={amount} size="sm" className="inline" />
      </p>
    </div>
  );
}
