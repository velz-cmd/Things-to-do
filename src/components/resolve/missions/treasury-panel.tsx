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
  recentBatches: Array<{
    id: string;
    status: string;
    totalAmountUsd: number;
    payeeCount: number;
    eventCount: number;
    explorerUrl: string | null;
  }>;
}

export function TreasuryPanel({ embedded }: { embedded?: boolean }) {
  const [data, setData] = useState<TreasuryData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/treasury");
    setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="grid gap-2 p-3 md:grid-cols-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className={embedded ? "p-3 space-y-3" : "mx-auto max-w-5xl px-6 py-6 space-y-6"}>
      {!embedded && (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-resolve-muted">
            Treasury
          </p>
          <h1 className="mt-1 text-xl font-semibold text-white">Mission treasury</h1>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-3">
        <Panel className="p-3">
          <p className="text-[10px] uppercase text-resolve-muted">Settled</p>
          <Money amount={data?.totalDistributedUsd ?? 0} size="sm" className="mt-1" />
        </Panel>
        <Panel className="p-3">
          <p className="text-[10px] uppercase text-resolve-muted">Batches</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-white">
            {data?.batchCount ?? 0}
          </p>
        </Panel>
        <Panel className="p-3">
          <p className="text-[10px] uppercase text-resolve-muted">Contributors</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-white">
            {data?.contributorCount ?? 0}
          </p>
        </Panel>
      </div>

      <Panel className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-resolve-border px-3 py-2">
          <p className="text-xs font-medium text-white">Recent batches</p>
          <button
            type="button"
            onClick={async () => {
              await fetch("/api/treasury", { method: "POST" });
              await load();
              toast.success("Registry seeded");
            }}
            className="text-[10px] text-resolve-accent hover:underline"
          >
            Seed demo
          </button>
        </div>
        {!data?.recentBatches?.length ? (
          <EmptyState
            title="No batches"
            description="Run a distribution from the panel below."
            className="border-0 bg-transparent py-6"
          />
        ) : (
          <ul className="divide-y divide-resolve-border text-xs">
            {data.recentBatches.slice(0, 5).map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-resolve-hover/40"
              >
                <div>
                  <p className="font-medium tabular-nums text-white">
                    ${b.totalAmountUsd.toFixed(2)}
                  </p>
                  <p className="text-resolve-muted">
                    {b.payeeCount} payees · {b.eventCount} events
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusChip
                    label={b.status}
                    variant={b.status === "settled" ? "settled" : "waiting"}
                  />
                  {b.explorerUrl && (
                    <a
                      href={b.explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-resolve-accent"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {!embedded && (
        <Link href="/missions?panel=distribute" className="text-xs text-resolve-accent">
          Run distribution →
        </Link>
      )}
    </div>
  );
}
