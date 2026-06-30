"use client";

import { useEffect, useState } from "react";
import { DiscoverBubblemapMetrics } from "@/components/resolve/discover/discover-bubblemap-metrics";
import type { DiscoverGraphNode } from "@/lib/discover/radar";

type RadarSlice = {
  graph: { nodes: DiscoverGraphNode[] };
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
};

/** Advanced graph metrics for a community — PageRank + funding entropy from live radar. */
export function CommunityGraphObservatory({ slug }: { slug: string }) {
  const [data, setData] = useState<RadarSlice | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/discover/radar")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("radar"))))
      .then((payload: RadarSlice & { graph: { nodes: DiscoverGraphNode[] } }) => {
        if (cancelled) return;
        const related = payload.graph.nodes.filter(
          (n) => n.communitySlug === slug || n.id === `community:${slug}`,
        );
        const relatedIds = new Set(related.map((n) => n.id));
        const topNodes = payload.metrics.topNodes.filter((t) => relatedIds.has(t.id));
        setData({
          graph: { nodes: related },
          metrics: {
            ...payload.metrics,
            topNodes: topNodes.length ? topNodes : payload.metrics.topNodes.slice(0, 3),
          },
        });
      })
      .catch(() => {
        if (!cancelled) setError("Graph metrics unavailable — connect sensors and refresh Discover");
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <section id="observatory" className="scroll-mt-24">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-accent">
        Observatory
      </p>
      <h2 className="mt-1 text-base font-semibold text-white">Graph metrics</h2>
      <p className="mt-1 text-xs text-resolve-muted">
        Funding entropy and PageRank from the live value graph — same data as Discover bubble map
        Advanced tab.
      </p>
      {error && <p className="mt-4 text-sm text-resolve-muted">{error}</p>}
      {data && (
        <div className="mt-4">
          <DiscoverBubblemapMetrics
            metrics={data.metrics}
            nodes={data.graph.nodes}
            className="border-0 p-0 sm:grid-cols-2"
          />
        </div>
      )}
    </section>
  );
}
