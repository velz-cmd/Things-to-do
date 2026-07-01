"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { bubbleOperatorActions, filterGraphByIntent } from "@/lib/discover/graph-node-actions";
import {
  DiscoverBubbleOperatorPanel,
  type BubbleOperatorAnchor,
} from "@/components/resolve/discover/discover-bubble-operator-panel";
import {
  useCommunityConsoleOptional,
  type CommunityConsoleTab,
  type CommunityConsoleActionContext,
} from "@/components/resolve/discover/discover-community-console-provider";
import type { AutomationTrigger } from "@/lib/automation/types";
import { DiscoverBubblemapSkeleton } from "@/components/resolve/discover/discover-skeletons";
import { DiscoverPremiumSection } from "@/components/resolve/discover/discover-premium-section";
import { discoverFetchErrorToast } from "@/lib/discover/fetch-error-toast";
import { DiscoverSectionRefresh } from "@/components/resolve/discover/discover-section-refresh";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import { VALUE_GRAPH_FOOTER, VALUE_GRAPH_MAP_HINT, VALUE_GRAPH_SUBTITLE } from "@/lib/discover/resolve-value-copy";
import { DiscoverValueNodeStrip } from "@/components/resolve/discover/discover-value-node-strip";

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
const VIEW_H = 200;
const PAD_X = 16;
const PAD_Y = 14;

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
  const hubR = Math.min(42, 18 + Math.sqrt(Math.max(hub.weight, 1)) * 4.5);

  const placed: BubbleNode[] = [
    {
      ...hub,
      r: hubR,
      cx: VIEW_W / 2,
      cy: VIEW_H / 2,
    },
  ];

  const orbit = sorted.slice(1);
  const n = orbit.length;
  const innerCount = Math.max(1, Math.ceil(n / 2));

  orbit.forEach((node, i) => {
    const onInner = i < innerCount;
    const ringIndex = onInner ? i : i - innerCount;
    const ringSize = onInner ? innerCount : n - innerCount;
    const angle = (2 * Math.PI * ringIndex) / Math.max(ringSize, 1) - Math.PI / 2;
    const r = Math.min(30, 10 + Math.sqrt(Math.max(node.weight, 0.5)) * 3);

    const rx = (VIEW_W / 2 - PAD_X - r) * (onInner ? 0.52 : 0.94);
    const ry = (VIEW_H / 2 - PAD_Y - r) * (onInner ? 0.48 : 0.82);

    placed.push({
      ...node,
      r,
      cx: VIEW_W / 2 + rx * Math.cos(angle),
      cy: VIEW_H / 2 + ry * Math.sin(angle),
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
  role = "all",
  signedIn = false,
}: {
  className?: string;
  intent?: DiscoverIntent;
  role?: DiscoverRole;
  signedIn?: boolean;
}) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<RadarPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dataRef = useRef<RadarPayload | null>(null);
  dataRef.current = data;
  const [hovered, setHovered] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [domainFilter, setDomainFilter] = useState<GraphDomainFilter>("all");
  const [panel, setPanel] = useState<BubbleOperatorAnchor | null>(null);
  const [stripSelectedId, setStripSelectedId] = useState<string | null>(null);
  const [panelTab, setPanelTab] = useState<CommunityConsoleTab>("console");
  const [panelTrigger, setPanelTrigger] = useState<AutomationTrigger | undefined>();
  const [panelContext, setPanelContext] = useState<CommunityConsoleActionContext | undefined>();
  const consoleBridge = useCommunityConsoleOptional();
  const isMobile = useMediaQuery("(max-width: 640px)");

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
    void loadRadar();
  }, [loadRadar]);

  const filteredGraph = useMemo(() => {
    const nodes = data?.graph.nodes ?? [];
    const edges = data?.graph.edges ?? [];
    const byDomain = filterGraphByDomain(nodes, edges, domainFilter);
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
  const viewH = expanded ? (isMobile ? 420 : 480) : VIEW_H;
  const scaleX = viewW / VIEW_W;
  const scaleY = viewH / VIEW_H;

  const modeLabel = data?.live
    ? `Live ledger · ${data.ledgerEventCount ?? 0} authorization${(data.ledgerEventCount ?? 0) === 1 ? "" : "s"}`
    : data?.hasCatalogPreview
      ? "Catalog preview + ledger nodes — dashed rings are structural; click for actions"
      : hasGraph
        ? "Ledger nodes — attach communities on Board to grow the graph"
        : "Loading graph — attach a community on Board to add live nodes";

  const panelActions = useMemo(() => {
    if (!panel) return [];
    return bubbleOperatorActions(panel.node, data?.graph.edges ?? []);
  }, [panel, data?.graph.edges]);

  const handleNodeClick = (b: BubbleNode) => {
    setPanelTab("console");
    setPanelTrigger(undefined);
    setPanelContext(undefined);
    setStripSelectedId(b.id);
    setPanel({ node: b });
  };

  const handleStripSelect = (node: DiscoverGraphNode) => {
    setPanelTab("console");
    setPanelTrigger(undefined);
    setPanelContext(undefined);
    setStripSelectedId(node.id);
    setPanel({ node });
  };

  useEffect(() => {
    const req = consoleBridge?.request;
    if (!req) return;

    const existing = data?.graph.nodes.find((n) => n.communitySlug === req.communitySlug);
    const node =
      req.node ??
      existing ?? {
        id: `community:${req.communitySlug}`,
        label: req.label ?? req.communitySlug,
        type: "community" as const,
        weight: 1,
        communitySlug: req.communitySlug,
      };

    setPanelTab(req.tab ?? "console");
    setPanelTrigger(req.automationTrigger);
    setPanelContext(req.actionContext);
    setPanel({ node });
    consoleBridge.clearRequest();
  }, [consoleBridge, consoleBridge?.request, data?.graph.nodes]);

  const sectionBody = (
    <>
      <p className="mb-3 text-[11px] leading-relaxed text-resolve-muted-dim">
        {role === "community"
          ? "Creators: open person/artist nodes to view proof — claim on Capital."
          : role === "funder" || role === "dao"
            ? "Fund & Sponsor move Arc USDC on testnet when you confirm."
            : role === "founder" || role === "operator"
              ? "Install community nodes — sensors sync verified events to the ledger."
              : "Click any node for actions — Fund, Attach, Observe, Automate."}
      </p>

      {hasGraph && (
        <DiscoverValueNodeStrip
          nodes={filteredGraph.nodes}
          edges={filteredGraph.edges}
          selectedId={stripSelectedId ?? panel?.node.id ?? null}
          onSelect={handleStripSelect}
          signedIn={signedIn}
          live={Boolean(data?.live)}
        />
      )}

      <div className="mt-3 flex flex-wrap gap-1.5 border-b border-white/[0.04] px-0 pb-2">
        {GRAPH_DOMAIN_CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => setDomainFilter(chip.id)}
            className={clsx(
              "discover-chip-pill",
              domainFilter === chip.id
                ? chip.id === "oss"
                  ? "discover-chip-pill--oss-active"
                  : chip.id === "music"
                    ? "discover-chip-pill--music-active"
                    : chip.id === "research"
                      ? "discover-chip-pill--research-active"
                      : "discover-chip-pill--active"
                : "discover-chip-pill--idle",
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
              ? `No ${domainFilter} nodes in the current graph — try another filter or explore a community below.`
              : data?.emptyReason ?? "Ledger graph is empty — attach a community on Board, then refresh"}
          </p>
        </div>
      ) : (
        <>
          <p className="mb-2 text-[10px] text-resolve-muted-dim">{VALUE_GRAPH_MAP_HINT}</p>
        <div className="discover-bubblemap-stage relative overflow-hidden rounded-xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-black/20 p-1.5">
          <svg
            viewBox={`0 0 ${viewW} ${viewH}`}
            className={clsx(
              "discover-bubblemap-svg mx-auto w-full max-w-full touch-manipulation",
              expanded ? "h-auto" : "aspect-[18/5] max-h-[200px]",
            )}
            role="img"
            aria-label="Value bubblemap"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <filter id="bubble-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="bubble-glow-strong" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
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
                      stopOpacity={dimmed ? 0.2 : synthetic ? 0.72 : 0.95}
                    />
                    <stop
                      offset="100%"
                      stopColor={fill}
                      stopOpacity={dimmed ? 0.08 : synthetic ? 0.28 : 0.35}
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

            {bubbles.map((b, bubbleIndex) => {
              const isHub = b.id === "pool:ledger" || b.id === bubbles[0]?.id;
              const isEcosystem = b.type === "ecosystem" || b.type === "repository";
              const active = hovered === b.id || panel?.node.id === b.id;
              const fill = NODE_COLORS[b.type] ?? "#94a3b8";
              const pending = b.pendingFunding;
              const synthetic = b.synthetic;
              const r = (b.r + (active ? 3 : 0)) * Math.min(scaleX, scaleY);
              const shortLabel =
                b.label.length > 10 ? `${b.label.slice(0, 8)}…` : b.label;

              return (
                <g
                  key={b.id}
                  className="discover-bubble-node cursor-pointer"
                  style={{ animationDelay: `${(bubbleIndex % 8) * 0.35}s` }}
                  onMouseEnter={() => setHovered(b.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => handleNodeClick(b)}
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
                    filter={active || isHub ? "url(#bubble-glow-strong)" : "url(#bubble-glow)"}
                  />
                  {isHub && (
                    <text
                      x={b.cx * scaleX}
                      y={b.cy * scaleY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="fill-white font-semibold"
                      style={{ fontSize: 9 * Math.min(scaleX, scaleY) }}
                    >
                      {b.id === "pool:ledger" ? "LEDGER" : "VALUE"}
                    </text>
                  )}
                  {!isHub && (active || b.r > 18) && r > 12 && (
                    <text
                      x={b.cx * scaleX}
                      y={b.cy * scaleY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className={clsx(
                        "pointer-events-none font-medium",
                        isEcosystem ? "fill-slate-300/90" : "fill-white/90",
                      )}
                      style={{ fontSize: Math.min(9, r * 0.42) * Math.min(scaleX, scaleY) }}
                    >
                      {isEcosystem ? "⬡ " : ""}
                      {shortLabel}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {hovered && !panel && (
            <div className="discover-bubble-tooltip absolute bottom-2 left-2 max-w-[min(240px,70%)] rounded-lg border border-white/12 bg-black/75 px-2.5 py-1.5 text-[10px] text-resolve-muted backdrop-blur-md">
              {(() => {
                const b = bubbles.find((n) => n.id === hovered);
                if (!b) return null;
                return (
                  <>
                    <p className="font-medium text-white">{b.label}</p>
                    <p className="mt-0.5">
                      {b.type}
                      {b.pendingFunding ? " · pending funding" : ""}
                      {" · click for console"}
                    </p>
                  </>
                );
              })()}
            </div>
          )}
        </div>
        </>
      )}

      {data?.updatedAt && (
        <p className="border-t border-white/[0.04] px-0 py-1.5 text-[9px] text-resolve-muted-dim">
          {VALUE_GRAPH_FOOTER}
        </p>
      )}
    </>
  );

  const bubblemapActions = (
    <>
      <span
        className={clsx(
          "discover-status-badge",
          data?.live ? "discover-status-badge--live" : "discover-status-badge--preview",
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
        className="discover-toolbar-btn"
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
            id="value-graph"
            title="Value graph"
            subtitle={modeLabel ? `${modeLabel} · ${VALUE_GRAPH_SUBTITLE}` : VALUE_GRAPH_SUBTITLE}
            className={className}
            variant="compact"
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
                    <p className="text-sm font-semibold text-white">Value graph</p>
                    <p className="text-[11px] text-resolve-muted">{modeLabel} · Click a bubble for operator console</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">{bubblemapActions}</div>
              </div>
            </div>
            <div className="relative min-h-full px-4 py-4">{sectionBody}</div>
          </div>
        </div>
      )}

      <DiscoverBubbleOperatorPanel
        anchor={panel}
        actions={panelActions}
        nodes={data?.graph.nodes ?? []}
        edges={data?.graph.edges ?? []}
        metrics={data?.metrics ?? null}
        signedIn={signedIn}
        initialTab={panelTab}
        automationTrigger={panelTrigger}
        actionContext={panelContext}
        onClose={() => {
          setPanel(null);
          setStripSelectedId(null);
        }}
      />
    </>
  );
}
