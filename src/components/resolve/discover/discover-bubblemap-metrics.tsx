"use client";

import Link from "next/link";
import clsx from "clsx";
import type { DiscoverGraphNode } from "@/lib/discover/radar";

type MetricsPayload = {
  topNodes: Array<{
    id: string;
    label: string;
    degreeCentrality: number;
    betweenness: number;
    pageRank: number;
    evidence: string;
  }>;
  fundingEntropy: {
    entropy: number;
    maxEntropy: number;
    concentrationPct: number;
    evidence: string;
  };
};

type DiscoverBubblemapMetricsProps = {
  metrics: MetricsPayload | null;
  nodes: DiscoverGraphNode[];
  className?: string;
};

/** Funding entropy + structural importance — merged from ValueGraph below bubblemap */
export function DiscoverBubblemapMetrics({
  metrics,
  nodes,
  className,
}: DiscoverBubblemapMetricsProps) {
  if (!metrics) return null;

  return (
    <div className={clsx("grid gap-4 border-t border-white/[0.06] p-4 sm:grid-cols-2", className)}>
      <div className="rounded-xl border border-resolve-border/60 bg-resolve-bg-deep/25 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-resolve-muted-dim">
          Funding entropy
        </p>
        <p className="mt-2 text-2xl font-semibold tabular-nums text-white">
          {metrics.fundingEntropy.entropy.toFixed(2)}
          <span className="ml-1 text-sm font-normal text-resolve-muted">
            / {metrics.fundingEntropy.maxEntropy.toFixed(2)} bits
          </span>
        </p>
        <p className="mt-1 text-[10px] text-resolve-muted-dim">
          {metrics.fundingEntropy.concentrationPct.toFixed(0)}% concentration
        </p>
        <p className="mt-2 text-xs leading-relaxed text-resolve-muted">
          {metrics.fundingEntropy.evidence}
        </p>
      </div>

      <div className="rounded-xl border border-resolve-border/60 bg-resolve-bg-deep/25 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-resolve-muted-dim">
          Top nodes
        </p>
        <ul className="mt-3 space-y-2.5">
          {(metrics.topNodes ?? []).slice(0, 5).map((n) => {
            const entityPath = nodes.find((gn) => gn.id === n.id)?.entityPath;
            return (
              <li key={n.id} className="text-xs">
                {entityPath ? (
                  <Link href={entityPath} className="font-medium text-resolve-accent hover:underline">
                    {n.label}
                  </Link>
                ) : (
                  <p className="font-medium text-white">{n.label}</p>
                )}
                <p className="mt-0.5 text-[10px] text-resolve-muted">{n.evidence}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
