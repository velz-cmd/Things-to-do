"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { GlassPanel } from "@/components/resolve/ui/glass-panel";
import { ExternalLink, Landmark, Users, Zap } from "lucide-react";

interface TreasuryData {
  totalDistributedUsd: number;
  batchCount: number;
  contributorCount: number;
  missionSettledUsd: number;
  recentBatches: Array<{
    id: string;
    status: string;
    totalAmountUsd: number;
    payeeCount: number;
    eventCount: number;
    txHash: string | null;
    explorerUrl: string | null;
    createdAt: string;
  }>;
}

export default function TreasuryPage() {
  const [data, setData] = useState<TreasuryData | null>(null);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/treasury");
    setData(await res.json());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function seedRegistry() {
    setSeeding(true);
    await fetch("/api/treasury", { method: "POST" });
    await load();
    setSeeding(false);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-8">
      <div className="mb-8">
        <p className="text-sm font-medium text-sky-400">Mission Control</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Treasury</h1>
        <p className="mt-2 max-w-2xl text-resolve-muted">
          Work gets funded only when outcomes are verified. Arc escrow holds mission
          budgets; verified batches release USDC to contributors.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          href="/distribute"
          className="rounded-full bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-400"
        >
          Distribute to creators
        </Link>
        <Link
          href="/contributors"
          className="rounded-full border border-white/15 px-5 py-2.5 text-sm text-white hover:bg-white/5"
        >
          Contributor registry
        </Link>
        <button
          type="button"
          onClick={() => void seedRegistry()}
          disabled={seeding}
          className="rounded-full border border-white/15 px-5 py-2.5 text-sm text-white hover:bg-white/5 disabled:opacity-50"
        >
          {seeding ? "Seeding…" : "Seed demo registry"}
        </button>
        <button
          type="button"
          onClick={async () => {
            const res = await fetch("/api/webhooks/github", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                pull_request: { merged: true, number: 1, title: "Logo approved" },
                repository: { full_name: "demo/logo-bounty" },
              }),
            });
            const data = await res.json();
            if (res.ok) toast.success("Bounty proof submitted", { description: "Check mission timeline" });
            else toast.error(data.message ?? "No active bounty mission");
          }}
          className="rounded-full border border-white/15 px-5 py-2.5 text-sm text-white hover:bg-white/5"
        >
          Trigger PR merge (bounty demo)
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <GlassPanel className="p-5">
          <div className="flex items-center gap-2 text-sky-300">
            <Landmark className="h-4 w-4" />
            <p className="text-xs uppercase tracking-wide">Total settled</p>
          </div>
          <p className="mt-3 text-3xl font-semibold text-white">
            ${(data?.totalDistributedUsd ?? 0).toFixed(2)}
          </p>
        </GlassPanel>
        <GlassPanel className="p-5">
          <div className="flex items-center gap-2 text-sky-300">
            <Zap className="h-4 w-4" />
            <p className="text-xs uppercase tracking-wide">Distribution batches</p>
          </div>
          <p className="mt-3 text-3xl font-semibold text-white">{data?.batchCount ?? 0}</p>
        </GlassPanel>
        <GlassPanel className="p-5">
          <div className="flex items-center gap-2 text-sky-300">
            <Users className="h-4 w-4" />
            <p className="text-xs uppercase tracking-wide">Contributors</p>
          </div>
          <p className="mt-3 text-3xl font-semibold text-white">
            {data?.contributorCount ?? 0}
          </p>
        </GlassPanel>
      </div>

      <GlassPanel className="mt-8 p-6">
        <h2 className="text-lg font-semibold text-white">Recent batches</h2>
        {!data?.recentBatches?.length ? (
          <p className="mt-4 text-sm text-resolve-muted">
            No batches yet. Run a distribution from the Distribute page.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-white/5">
            {data.recentBatches.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-medium text-white">
                    ${b.totalAmountUsd.toFixed(2)} → {b.payeeCount} payees
                  </p>
                  <p className="text-xs text-resolve-muted">
                    {b.eventCount} events · {b.status} · {new Date(b.createdAt).toLocaleString()}
                  </p>
                </div>
                {b.explorerUrl && (
                  <a
                    href={b.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-sky-400 hover:text-sky-300"
                  >
                    Arcscan <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </GlassPanel>
    </div>
  );
}
