"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Orbit, ZoomIn } from "lucide-react";
import type { DiscoverGraphEdge, DiscoverGraphNode } from "@/lib/discover/radar";

type RadarPayload = {
  graph: { nodes: DiscoverGraphNode[]; edges: DiscoverGraphEdge[] };
  live: boolean;
  ledgerEventCount?: number;
  emptyReason: string | null;
};

type BubbleNode = DiscoverGraphNode & {
  r: number;
  cx: number;
  cy: number;
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

const VIEW_W = 720;
const VIEW_H = 420;

function layoutBubblemap(nodes: DiscoverGraphNode[]): BubbleNode[] {
  if (!nodes.length) return [];

  const sorted = [...nodes].sort((a, b) => b.weight - a.weight);
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

  const orbit = sorted.slice(1, 18);
  const baseOrbit = Math.min(VIEW_W, VIEW_H) * 0.28;

  orbit.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / orbit.length - Math.PI / 2;
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

export function DiscoverValueBubblemap({ className }: { className?: string }) {
  const router = useRouter();
  const [data, setData] = useState<RadarPayload | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    void fetch("/api/discover/radar")
      .then((r) => r.json())
      .then((d: RadarPayload) => setData(d))
      .catch(() => setData(null));
  }, []);

  const bubbles = useMemo(
    () => layoutBubblemap(data?.graph.nodes ?? []),
    [data?.graph.nodes],
  );

  const positions = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    for (const b of bubbles) m.set(b.id, { x: b.cx, y: b.cy });
    return m;
  }, [bubbles]);

  const hasGraph = bubbles.length > 0;
  const viewW = expanded ? 960 : VIEW_W;
  const viewH = expanded ? 560 : VIEW_H;
  const scaleX = viewW / VIEW_W;
  const scaleY = viewH / VIEW_H;

  return (
    <section
      className={clsx(
        "relative overflow-hidden rounded-2xl border border-resolve-accent/20 bg-[#04070d]",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 50%, rgba(96,165,250,0.12), transparent 55%), linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "auto, 40px 40px, 40px 40px",
        }}
      />

      <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2">
          <Orbit className="h-4 w-4 text-resolve-accent" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-accent">
              Value command center
            </p>
            <p className="text-[11px] text-resolve-muted">
              Bubblemap of live authorizations — click any node to open
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {data?.live && (
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
              {data.ledgerEventCount ?? 0} ledger events
            </span>
          )}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[10px] text-resolve-muted hover:text-white"
          >
            <ZoomIn className="h-3 w-3" />
            {expanded ? "Compact" : "Expand"}
          </button>
        </div>
      </div>

      {!hasGraph ? (
        <div className="relative px-6 py-16 text-center">
          <p className="text-sm text-resolve-muted">
            {data?.emptyReason ?? "Graph fills as authorizations arrive — install a community to start"}
          </p>
        </div>
      ) : (
        <div className="relative p-2">
          <svg
            viewBox={`0 0 ${viewW} ${viewH}`}
            className="mx-auto h-auto w-full max-w-full"
            role="img"
            aria-label="Value bubblemap"
          >
            <defs>
              {bubbles.map((b) => {
                const fill = NODE_COLORS[b.type] ?? "#94a3b8";
                return (
                  <radialGradient key={`g-${b.id}`} id={`bubble-${b.id}`} cx="35%" cy="30%">
                    <stop offset="0%" stopColor={fill} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={fill} stopOpacity={0.35} />
                  </radialGradient>
                );
              })}
            </defs>

            {(data?.graph.edges ?? []).map((e) => {
              const from = positions.get(e.from);
              const to = positions.get(e.to);
              if (!from || !to) return null;
              return (
                <line
                  key={e.id}
                  x1={from.x * scaleX}
                  y1={from.y * scaleY}
                  x2={to.x * scaleX}
                  y2={to.y * scaleY}
                  stroke="rgba(96,165,250,0.12)"
                  strokeWidth={Math.min(2, 0.4 + Math.log10(e.weight + 1))}
                />
              );
            })}

            {bubbles.map((b) => {
              const isHub = b.id === bubbles[0]?.id;
              const active = hovered === b.id;
              const fill = NODE_COLORS[b.type] ?? "#94a3b8";
              return (
                <g
                  key={b.id}
                  className="cursor-pointer"
                  onMouseEnter={() => setHovered(b.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => {
                    if (b.entityPath) router.push(b.entityPath);
                  }}
                >
                  <circle
                    cx={b.cx * scaleX}
                    cy={b.cy * scaleY}
                    r={(b.r + (active ? 4 : 0)) * Math.min(scaleX, scaleY)}
                    fill={`url(#bubble-${b.id})`}
                    stroke={active ? fill : "rgba(255,255,255,0.15)"}
                    strokeWidth={active ? 2 : 1}
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
                      VALUE
                    </text>
                  )}
                  {(active || b.r > 30) && !isHub && (
                    <text
                      x={b.cx * scaleX}
                      y={b.cy * scaleY + b.r * scaleY + 12}
                      textAnchor="middle"
                      className="fill-resolve-muted"
                      style={{ fontSize: 9 * Math.min(scaleX, scaleY) }}
                    >
                      {b.label.length > 18 ? `${b.label.slice(0, 16)}…` : b.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {hovered && (
            <div className="absolute bottom-3 left-3 rounded-lg border border-white/10 bg-black/70 px-3 py-2 text-[11px] text-resolve-muted backdrop-blur">
              {(() => {
                const b = bubbles.find((n) => n.id === hovered);
                if (!b) return null;
                return (
                  <>
                    <p className="font-medium text-white">{b.label}</p>
                    <p className="mt-0.5">
                      {b.type} · weight {b.weight.toFixed(2)}
                      {b.entityPath ? " · click to open" : ""}
                    </p>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
