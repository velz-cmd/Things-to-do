"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import clsx from "clsx";
import { Maximize2, Minimize2, Orbit } from "lucide-react";
import type { DiscoverGraphEdge, DiscoverGraphNode } from "@/lib/discover/radar";
import type { DiscoverIntent } from "@/lib/discover/types";
import {
  filterGraphByDomain,
  GRAPH_DOMAIN_CHIPS,
  graphDomainForNode,
  nodeMatchesDomainFilter,
  tintForDomain,
  type GraphDomainFilter,
} from "@/lib/discover/graph-domain";
import { bubblePopoverActions, filterGraphByIntent } from "@/lib/discover/graph-node-actions";
import {
  DiscoverBubbleNodePopover,
  type BubblePopoverAnchor,
} from "@/components/resolve/discover/discover-bubble-node-popover";
import { DiscoverBubblemapMetrics } from "@/components/resolve/discover/discover-bubblemap-metrics";
import { DiscoverBubblemapSkeleton } from "@/components/resolve/discover/discover-skeletons";
import { DiscoverPremiumSection } from "@/components/resolve/discover/discover-premium-section";
import { discoverFetchErrorToast } from "@/lib/discover/fetch-error-toast";
import { DiscoverSectionRefresh } from "@/components/resolve/discover/discover-section-refresh";
import type { DiscoverRole } from "@/lib/discover/role-filters";

type RadarPayload = {
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
  updatedAt?: string;
};

type BubbleNode = DiscoverGraphNode & {
  r: number;
  cx: number;
  cy: number;
};

const MAX_BUBBLES = 24;
const VIEW_W = 720;
const VIEW_H = 420;

const NODE_COLORS: Record<string, string> = {
  creator: "#34d399",
  mission: "#60a5fa",
  connector: "#a78bfa",
  ecosystem: "#64748b",
  repository: "#64748b",
  person: "#fb923c",
  community: "#2dd4bf",
  treasury: "#f87171",
};

function layoutBubblemap(nodes: DiscoverGraphNode[]): BubbleNode[] {
  if (!nodes.length) return [];

  const sorted = [...nodes].sort((a, b) => b.weight - a.weight).slice(0, MAX_BUBBLES);
  const hub = sorted[0];
  const hubR = Math.min(72, 28 + Math.sqrt(Math.max(hub.weight, 1)) * 6);

  const placed: BubbleNode[] = [
    {
      ...hub,
      r: hubR,
      cx: VIEW_W / 2,
      cy: VIEW_H / 2,
    },
  ];

  const orbit = sorted.slice(1);
  const baseOrbit = Math.min(VIEW_W, VIEW_H) * 0.28;

  orbit.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / Math.max(orbit.length, 1) - Math.PI / 2;
    const r = Math.min(44, 14 + Math.sqrt(Math.max(node.weight, 0.5)) * 4);
    const dist = baseOrbit + (i % 2) * 36 + r;
    placed.push({
      ...node,
      r,
      cx: VIEW_W / 2 + dist * Math.cos(angle),
      cy: VIEW_H / 2 + dist * Math.sin(angle),
    });
  });

  return placed;
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

export function DiscoverValueBubblemap({
  className,
  intent = "all",
  role: _role = "all",
}: {
  className?: string;
  intent?: DiscoverIntent;
  role?: DiscoverRole;
}) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [data, setData] = useState<RadarPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dataRef = useRef<RadarPayload | null>(null);
  dataRef.current = data;
  const [hovered, setHovered] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [domainFilter, setDomainFilter] = useState<GraphDomainFilter>("all");
  const [popover, setPopover] = useState<BubblePopoverAnchor | null>(null);
  const isMobile = useMediaQuery("(max-width: 640px)");

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "120px", threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const loadRadar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/discover/radar");
      if (!res.ok) throw new Error("Radar unavailable");
      const d = (await res.json()) as RadarPayload;
      setData(d);
    } catch {
      setError("Could not load value graph");
      discoverFetchErrorToast(
        "discover-bubblemap",
        "Value graph unavailable",
        () => void loadRadar(),
        Boolean(dataRef.current),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    void loadRadar();
  }, [visible, loadRadar]);

  const filteredGraph = useMemo(() => {
    const byDomain = filterGraphByDomain(
      data?.graph.nodes ?? [],
      data?.graph.edges ?? [],
      domainFilter,
    );
    return filterGraphByIntent(byDomain.nodes, byDomain.edges, intent);
  }, [data?.graph.nodes, data?.graph.edges, domainFilter, intent]);

  const bubbles = useMemo(
    () => layoutBubblemap(filteredGraph.nodes),
    [filteredGraph.nodes],
  );

  const positions = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    for (const b of bubbles) m.set(b.id, { x: b.cx, y: b.cy });
    return m;
  }, [bubbles]);

  const hasGraph = bubbles.length > 0;
  const viewW = expanded ? (isMobile ? VIEW_W : 960) : VIEW_W;
  const viewH = expanded ? (isMobile ? 520 : 560) : VIEW_H;
  const scaleX = viewW / VIEW_W;
  const scaleY = viewH / VIEW_H;

  const modeLabel = data?.live
    ? `Live ledger · ${data.ledgerEventCount ?? 0} authorization${(data.ledgerEventCount ?? 0) === 1 ? "" : "s"}`
    : hasGraph
      ? "GitHub scan preview — estimated gaps from repo health, not ledger"
      : "Waiting for ledger events";

  const popoverActions = useMemo(() => {
    if (!popover) return [];
    return bubblePopoverActions(popover.node, data?.graph.edges ?? []);
  }, [popover, data?.graph.edges]);

  const handleNodeClick = (b: BubbleNode, event: MouseEvent<SVGGElement>) => {
    const rect = (event.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const cx = event.clientX - rect.left;
    const cy = event.clientY - rect.top;
    setPopover({
      node: b,
      x: rect.left + cx,
      y: rect.top + cy,
    });
  };

  const sectionBody = (
    <>
      <div className="flex flex-wrap gap-1.5 border-b border-white/[0.04] px-0 pb-2.5">
        {GRAPH_DOMAIN_CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => setDomainFilter(chip.id)}
            className={clsx(
              "rounded-full border px-2.5 py-0.5 text-[10px] font-medium transition",
              domainFilter === chip.id
                ? chip.id === "oss"
                  ? "border-amber-500/40 bg-amber-500/15 text-amber-100"
                  : chip.id === "music"
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-100"
                    : chip.id === "research"
                      ? "border-violet-500/40 bg-violet-500/15 text-violet-100"
                      : "border-resolve-accent/40 bg-resolve-accent/15 text-resolve-accent"
                : "border-white/10 text-resolve-muted hover:text-white",
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <DiscoverBubblemapSkeleton />
      ) : error && !hasGraph ? (
        <div className="px-6 py-16 text-center">
          <p className="text-sm text-resolve-muted">{error}</p>
          <button
            type="button"
            onClick={() => void loadRadar()}
            className="mt-3 text-xs font-medium text-resolve-accent hover:underline"
          >
            Retry
          </button>
        </div>
      ) : !hasGraph ? (
        <div className="relative px-6 py-16 text-center">
          <p className="text-sm text-resolve-muted">
            {domainFilter !== "all"
              ? `No ${domainFilter} nodes in the current graph — try another filter or connect a sensor.`
              : data?.emptyReason ?? "Graph fills as authorizations arrive — connect GitHub or Jellyfin to start"}
          </p>
        </div>
      ) : (
        <div className="relative p-2">
          <svg
            viewBox={`0 0 ${viewW} ${viewH}`}
            className="mx-auto h-auto w-full max-w-full touch-manipulation"
            role="img"
            aria-label="Value bubblemap"
          >
            <defs>
              {bubbles.map((b) => {
                const domain = graphDomainForNode(b);
                const domainTint =
                  domain !== "other" && domainFilter === "all" ? tintForDomain(domain) : null;
                const fill = domainTint ?? NODE_COLORS[b.type] ?? "#94a3b8";
                const dimmed =
                  domainFilter !== "all" && !nodeMatchesDomainFilter(b, domainFilter);
                const synthetic = b.synthetic;
                return (
                  <radialGradient key={`g-${b.id}`} id={`bubble-${b.id}`} cx="35%" cy="30%">
                    <stop
                      offset="0%"
                      stopColor={fill}
                      stopOpacity={dimmed || synthetic ? 0.2 : 0.95}
                    />
                    <stop
                      offset="100%"
                      stopColor={fill}
                      stopOpacity={dimmed || synthetic ? 0.08 : 0.35}
                    />
                  </radialGradient>
                );
              })}
            </defs>

            {(data?.graph.edges ?? []).map((e) => {
              const from = positions.get(e.from);
              const to = positions.get(e.to);
              if (!from || !to) return null;
              const gap = e.kind === "funding_gap";
              return (
                <line
                  key={e.id}
                  x1={from.x * scaleX}
                  y1={from.y * scaleY}
                  x2={to.x * scaleX}
                  y2={to.y * scaleY}
                  stroke={gap ? "rgba(251,191,36,0.35)" : "rgba(96,165,250,0.12)"}
                  strokeWidth={Math.min(2, 0.4 + Math.log10(e.weight + 1))}
                  strokeDasharray={gap ? "4 3" : undefined}
                />
              );
            })}

            {bubbles.map((b) => {
              const isHub = b.id === "pool:ledger" || b.id === bubbles[0]?.id;
              const isEcosystem = b.type === "ecosystem" || b.type === "repository";
              const active = hovered === b.id || popover?.node.id === b.id;
              const fill = NODE_COLORS[b.type] ?? "#94a3b8";
              const pending = b.pendingFunding;
              const synthetic = b.synthetic;
              const r = (b.r + (active ? 4 : 0)) * Math.min(scaleX, scaleY);

              return (
                <g
                  key={b.id}
                  className="cursor-pointer"
                  onMouseEnter={() => setHovered(b.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={(e) => handleNodeClick(b, e)}
                >
                  {synthetic && (
                    <circle
                      cx={b.cx * scaleX}
                      cy={b.cy * scaleY}
                      r={r + 3}
                      fill="none"
                      stroke="rgba(148,163,184,0.35)"
                      strokeWidth={1}
                      strokeDasharray="3 2"
                    />
                  )}
                  {pending && (
                    <circle
                      cx={b.cx * scaleX}
                      cy={b.cy * scaleY}
                      r={r + 6}
                      fill="none"
                      stroke="rgba(251,191,36,0.5)"
                      strokeWidth={2}
                      className="animate-pulse"
                    />
                  )}
                  <circle
                    cx={b.cx * scaleX}
                    cy={b.cy * scaleY}
                    r={r}
                    fill={`url(#bubble-${b.id})`}
                    stroke={active ? fill : pending ? "rgba(251,191,36,0.6)" : "rgba(255,255,255,0.15)"}
                    strokeWidth={active || pending ? 2 : 1}
                  />
                  {isHub && (
                    <text
                      x={b.cx * scaleX}
                      y={b.cy * scaleY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="fill-white text-[10px] font-semibold"
                      style={{ fontSize: 10 * Math.min(scaleX, scaleY) }}
                    >
                      {b.id === "pool:ledger" ? "LEDGER" : "VALUE"}
                    </text>
                  )}
                  {(active || b.r > 30) && !isHub && (
                    <text
                      x={b.cx * scaleX}
                      y={b.cy * scaleY + b.r * scaleY + 12}
                      textAnchor="middle"
                      className={clsx(isEcosystem ? "fill-slate-400" : "fill-resolve-muted")}
                      style={{ fontSize: 9 * Math.min(scaleX, scaleY) }}
                    >
                      {isEcosystem ? "⬡ " : ""}
                      {b.label.length > 18 ? `${b.label.slice(0, 16)}…` : b.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {hovered && !popover && (
            <div className="absolute bottom-3 left-3 rounded-lg border border-white/10 bg-black/70 px-3 py-2 text-[11px] text-resolve-muted backdrop-blur">
              {(() => {
                const b = bubbles.find((n) => n.id === hovered);
                if (!b) return null;
                return (
                  <>
                    <p className="font-medium text-white">{b.label}</p>
                    <p className="mt-0.5">
                      {b.type}
                      {b.pendingFunding ? " · pending funding" : ""}
                      {" · click for actions"}
                    </p>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {hasGraph && data?.metrics && (
        <DiscoverBubblemapMetrics
          metrics={data.metrics}
          nodes={data.graph.nodes}
        />
      )}

      {data?.updatedAt && (
        <p className="border-t border-white/[0.04] px-4 py-2 text-[9px] text-resolve-muted-dim">
          Manual refresh · people & creators are nodes · ⬡ = ecosystem (repo/index), not a user
        </p>
      )}
    </>
  );

  const bubblemapActions = (
    <>
      <span
        className={clsx(
          "rounded-full border px-2 py-0.5 text-[10px]",
          data?.live
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
            : "border-amber-500/30 bg-amber-500/10 text-amber-200",
        )}
      >
        {data?.live ? "Live ledger" : hasGraph ? "Scan preview" : "Awaiting data"}
      </span>
      <DiscoverSectionRefresh
        sectionId="value-bubblemap"
        onRefresh={loadRadar}
        lastUpdated={data?.updatedAt}
      />
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[10px] text-resolve-muted hover:text-white"
      >
        {expanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
        {expanded ? "Compact" : "Expand"}
      </button>
    </>
  );

  const showFullscreen = expanded && isMobile;

  return (
    <>
      {!showFullscreen && (
        <div ref={sectionRef}>
          <DiscoverPremiumSection
            title="Value command center"
            subtitle={modeLabel}
            className={className}
            actions={bubblemapActions}
          >
            {sectionBody}
          </DiscoverPremiumSection>
        </div>
      )}

      {showFullscreen && (
        <div className="fixed inset-0 z-40 flex flex-col bg-[#04070d]">
          <div ref={sectionRef} className="relative flex-1 overflow-y-auto">
            <div className="relative border-b border-white/[0.06] px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Orbit className="h-4 w-4 text-resolve-accent" />
                  <div>
                    <p className="text-sm font-semibold text-white">Value command center</p>
                    <p className="text-[11px] text-resolve-muted">{modeLabel}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">{bubblemapActions}</div>
              </div>
            </div>
            <div className="relative min-h-full px-4 py-4">{sectionBody}</div>
          </div>
        </div>
      )}

      <DiscoverBubbleNodePopover
        anchor={popover}
        actions={popoverActions}
        onClose={() => setPopover(null)}
        mobileSheet={isMobile}
      />
    </>
  );
}
