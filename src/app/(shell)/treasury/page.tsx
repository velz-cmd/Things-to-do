"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { Panel } from "@/components/resolve/ui/panel";
import { Money } from "@/components/resolve/ui/money";
import { CardSkeleton } from "@/components/resolve/ui/skeleton";
import { EmptyState } from "@/components/resolve/ui/empty-state";
import { StatusChip } from "@/components/resolve/ui/status-chip";

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
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/treasury");
    setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function seedRegistry() {
    setSeeding(true);
    await fetch("/api/treasury", { method: "POST" });
    await load();
    setSeeding(false);
    toast.success("Registry seeded");
  }

  if (loading) {
    return (
      <div className="grid gap-4 p-6 md:grid-cols-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl animate-resolve-enter px-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-resolve-muted">
            Treasury
          </p>
          <h1 className="mt-1 text-xl font-semibold text-white">Mission treasury</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/distribute"
            className="rounded-md bg-resolve-accent px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500"
          >
            Distribute
          </Link>
          <button
            type="button"
            onClick={() => void seedRegistry()}
            disabled={seeding}
            className="rounded-md border border-resolve-border-strong px-3 py-2 text-xs text-white hover:bg-resolve-hover disabled:opacity-50"
          >
            {seeding ? "Seeding…" : "Seed registry"}
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
              const d = await res.json();
              if (res.ok) toast.success("Bounty proof submitted");
              else toast.error(d.message ?? "No active bounty");
            }}
            className="rounded-md border border-resolve-border-strong px-3 py-2 text-xs text-white hover:bg-resolve-hover"
          >
            Trigger PR merge
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <Panel>
          <p className="text-[11px] uppercase text-resolve-muted">Total settled</p>
          <Money amount={data?.totalDistributedUsd ?? 0} size="md" className="mt-2" />
        </Panel>
        <Panel>
          <p className="text-[11px] uppercase text-resolve-muted">Batches</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-white">
            {data?.batchCount ?? 0}
          </p>
        </Panel>
        <Panel>
          <p className="text-[11px] uppercase text-resolve-muted">Contributors</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-white">
            {data?.contributorCount ?? 0}
          </p>
        </Panel>
      </div>

      <Panel className="mt-6 p-0 overflow-hidden">
        <div className="border-b border-resolve-border-strong px-5 py-3">
          <p className="text-sm font-medium text-white">Recent batches</p>
        </div>
        {!data?.recentBatches?.length ? (
          <EmptyState
            title="No batches yet"
            description="Run a distribution from the Distribute page."
            className="border-0 bg-transparent"
            action={
              <Link
                href="/distribute"
                className="rounded-md bg-resolve-accent px-3 py-2 text-xs font-semibold text-white"
              >
                Open distribute
              </Link>
            }
          />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-[10px] uppercase text-resolve-muted">
              <tr className="border-b border-resolve-border">
                <th className="px-5 py-2.5 font-medium">Amount</th>
                <th className="px-5 py-2.5 font-medium">Payees</th>
                <th className="px-5 py-2.5 font-medium">Events</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
                <th className="px-5 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {data.recentBatches.map((b) => (
                <tr key={b.id} className="border-b border-resolve-border hover:bg-resolve-hover/40">
                  <td className="px-5 py-3 tabular-nums font-medium text-white">
                    ${b.totalAmountUsd.toFixed(2)}
                  </td>
                  <td className="px-5 py-3 tabular-nums text-resolve-muted">{b.payeeCount}</td>
                  <td className="px-5 py-3 tabular-nums text-resolve-muted">{b.eventCount}</td>
                  <td className="px-5 py-3">
                    <StatusChip
                      label={b.status}
                      variant={b.status === "settled" ? "settled" : "waiting"}
                    />
                  </td>
                  <td className="px-5 py-3 text-right">
                    {b.explorerUrl && (
                      <a
                        href={b.explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-resolve-accent"
                      >
                        Arcscan
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
