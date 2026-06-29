"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { GitBranch, Network } from "lucide-react";
import type { DiscoverGraphEdge, DiscoverGraphNode } from "@/lib/discover/radar";

type RadarGraphResponse = {
  graph: { nodes: DiscoverGraphNode[]; edges: DiscoverGraphEdge[] };
  metrics: {
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
  live: boolean;
  hasCatalogPreview?: boolean;
  ledgerEventCount?: number;
  emptyReason: string | null;
};

const NODE_COLORS: Record<string, string> = {
  creator: "#34d399",
  mission: "#60a5fa",
  connector: "#a78bfa",
  repository: "#fbbf24",
  person: "#fb923c",
  community: "#2dd4bf",
  treasury: "#f87171",
};

type ValueGraphProps = {
  variant?: "full" | "compact";
  className?: string;
};

export function ValueGraph({ variant = "full", className }: ValueGraphProps) {
  const [data, setData] = useState<RadarGraphResponse | null>(null);

  useEffect(() => {
    void fetch("/api/discover/radar")
      .then((r) => r.json())
      .then((d: RadarGraphResponse) => setData(d))
      .catch(() => setData(null));
  }, []);

  const positions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    for (const n of data?.graph.nodes ?? []) {
      if (n.x != null && n.y != null) map.set(n.id, { x: n.x, y: n.y });
    }
    return map;
  }, [data?.graph.nodes]);

  const hasGraph = (data?.graph.nodes.length ?? 0) > 0;
  const compact = variant === "compact";
  const viewW = compact ? 280 : 400;
  const viewH = compact ? 180 : 280;

  const graphSvg = (
    <svg
      viewBox={`0 0 ${viewW} ${viewH}`}
      className="h-auto w-full"
      role="img"
      aria-label="Global value graph"
    >
      <defs>
        <linearGradient id="valueEdgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(96,165,250,0.15)" />
          <stop offset="100%" stopColor="rgba(52,211,153,0.35)" />
        </linearGradient>
      </defs>
      {(data?.graph.edges ?? []).map((e) => {
        const from = positions.get(e.from);
        const to = positions.get(e.to);
        if (!from || !to) return null;
        const scaleX = viewW / 400;
        const scaleY = viewH / 280;
        return (
          <line
            key={e.id}
            x1={from.x * scaleX}
            y1={from.y * scaleY}
            x2={to.x * scaleX}
            y2={to.y * scaleY}
            stroke="url(#valueEdgeGrad)"
            strokeWidth={Math.min(3, 0.5 + Math.log10(e.weight + 1))}
          />
        );
      })}
      {(data?.graph.nodes ?? []).map((n) => {
        const p = positions.get(n.id);
        if (!p) return null;
        const scaleX = viewW / 400;
        const scaleY = viewH / 280;
        const fill = NODE_COLORS[n.type] ?? "#94a3b8";
        const r = compact ?
          Math.min(10, 4 + Math.log10(n.weight + 1) * 2)
        : Math.min(14, 6 + Math.log10(n.weight + 1) * 3);
        return (
          <g key={n.id}>
            <circle
              cx={p.x * scaleX}
              cy={p.y * scaleY}
              r={r}
              fill={fill}
              fillOpacity={0.85}
            />
            <title>{`${n.label} (${n.type})`}</title>
          </g>
        );
      })}
    </svg>
  );

  if (compact) {
    return (
      <section className={clsx("space-y-2", className)}>
        <div className="flex items-center gap-2">
          <Network className="h-3.5 w-3.5 text-resolve-accent" />
          <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
            Value graph
          </p>
        </div>
        {!hasGraph ? (
          <p className="text-[10px] leading-relaxed text-resolve-muted">
            {data?.emptyReason ?? "Graph fills as ledger authorizations arrive."}
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-white/[0.06] bg-[#060a12]/80 p-1">
            {graphSvg}
            <p className="px-2 py-1 text-[9px] text-resolve-muted-dim">
              {data?.graph.nodes.length} nodes
              {data?.live
                ? ` · ${data.ledgerEventCount ?? 0} ledger events`
                : data?.hasCatalogPreview
                  ? " · catalog preview"
                  : ""}
            </p>
          </div>
        )}
        <Link href="/discover" className="text-[10px] text-resolve-accent hover:underline">
          Open full graph →
        </Link>
      </section>
    );
  }

  return (
    <section className={clsx("mb-12", className)}>
      <div className="mb-4 flex items-center gap-2">
        <Network className="h-4 w-4 text-resolve-accent" />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-accent">
            Global value graph
          </p>
          <p className="text-xs text-resolve-muted">
            Full ledger slice — degree, betweenness, PageRank, funding entropy
          </p>
        </div>
      </div>

      {!hasGraph ? (
        <div className="rounded-xl border border-dashed border-resolve-border/80 bg-resolve-bg-deep/20 px-5 py-8 text-center">
          <GitBranch className="mx-auto h-8 w-8 text-resolve-muted-dim" strokeWidth={1.25} />
          <p className="mt-3 text-sm text-resolve-muted">
            {data?.emptyReason ??
              "Graph populates when authorizations or funding-gap signals exist."}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="overflow-hidden rounded-xl border border-resolve-border/60 bg-[#060a12]/80 p-2">
            {graphSvg}
            <p className="border-t border-resolve-border/40 px-3 py-2 text-[10px] text-resolve-muted-dim">
              {data?.graph.nodes.length} nodes · {data?.graph.edges.length} edges ·{" "}
              {data?.live
                ? `${data.ledgerEventCount ?? 0} ledger events`
                : data?.hasCatalogPreview
                  ? "catalog preview — install a community for live data"
                  : "waiting for events"}
            </p>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-resolve-border/60 bg-resolve-bg-deep/25 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-resolve-muted-dim">
                Funding entropy
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-white">
                {data?.metrics.fundingEntropy.entropy.toFixed(2)}
                <span className="ml-1 text-sm font-normal text-resolve-muted">
                  / {data?.metrics.fundingEntropy.maxEntropy.toFixed(2)} bits
                </span>
              </p>
              <p className="mt-2 text-xs leading-relaxed text-resolve-muted">
                {data?.metrics.fundingEntropy.evidence}
              </p>
            </div>

            <div className="rounded-xl border border-resolve-border/60 bg-resolve-bg-deep/25 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-resolve-muted-dim">
                Structural importance
              </p>
              <ul className="mt-3 space-y-3">
                {(data?.metrics.topNodes ?? []).map((n) => (
                  <li key={n.id} className="text-xs">
                    {data?.graph.nodes.find((gn) => gn.id === n.id)?.entityPath ? (
                      <Link
                        href={data.graph.nodes.find((gn) => gn.id === n.id)!.entityPath!}
                        className="font-medium text-resolve-accent hover:underline"
                      >
                        {n.label}
                      </Link>
                    ) : (
                      <p className="font-medium text-white">{n.label}</p>
                    )}
                    <p className="mt-0.5 text-resolve-muted">{n.evidence}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
