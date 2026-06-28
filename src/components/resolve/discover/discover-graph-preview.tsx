"use client";

import { useEffect, useMemo, useState } from "react";
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

export function DiscoverGraphPreview({ className }: { className?: string }) {
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

  return (
    <section className={clsx("mb-12", className)}>
      <div className="mb-4 flex items-center gap-2">
        <Network className="h-4 w-4 text-resolve-accent" />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-accent">
            Value graph preview
          </p>
          <p className="text-xs text-resolve-muted">
            Slice from ledger + sensors — degree, betweenness, PageRank, entropy
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
            <svg viewBox="0 0 400 280" className="h-auto w-full" role="img" aria-label="Value graph preview">
              <defs>
                <linearGradient id="edgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(96,165,250,0.15)" />
                  <stop offset="100%" stopColor="rgba(52,211,153,0.35)" />
                </linearGradient>
              </defs>
              {(data?.graph.edges ?? []).map((e) => {
                const from = positions.get(e.from);
                const to = positions.get(e.to);
                if (!from || !to) return null;
                return (
                  <line
                    key={e.id}
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke="url(#edgeGrad)"
                    strokeWidth={Math.min(3, 0.5 + Math.log10(e.weight + 1))}
                  />
                );
              })}
              {(data?.graph.nodes ?? []).map((n) => {
                const p = positions.get(n.id);
                if (!p) return null;
                const fill = NODE_COLORS[n.type] ?? "#94a3b8";
                const r = Math.min(14, 6 + Math.log10(n.weight + 1) * 3);
                return (
                  <g key={n.id}>
                    <circle cx={p.x} cy={p.y} r={r} fill={fill} fillOpacity={0.85} />
                    <title>{`${n.label} (${n.type})`}</title>
                  </g>
                );
              })}
            </svg>
            <p className="border-t border-resolve-border/40 px-3 py-2 text-[10px] text-resolve-muted-dim">
              {data?.graph.nodes.length} nodes · {data?.graph.edges.length} edges · hover nodes in
              metrics panel
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
                    <p className="font-medium text-white">{n.label}</p>
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
