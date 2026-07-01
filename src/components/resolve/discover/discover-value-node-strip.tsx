"use client";

import clsx from "clsx";
import type { DiscoverGraphNode } from "@/lib/discover/radar";
import type { DiscoverAction } from "@/lib/discover/types";
import { bubbleOperatorActions } from "@/lib/discover/graph-node-actions";
import type { DiscoverGraphEdge } from "@/lib/discover/radar";
import { graphDomainForNode, tintForDomain } from "@/lib/discover/graph-domain";
import { DiscoverInlineActionBar } from "@/components/resolve/discover/discover-inline-action-bar";

const TYPE_LABEL: Record<string, string> = {
  person: "Creator",
  creator: "Artist",
  community: "Community",
  ecosystem: "OSS",
  repository: "Repo",
  mission: "Program",
  treasury: "Treasury",
  connector: "Rail",
};

type DiscoverValueNodeStripProps = {
  nodes: DiscoverGraphNode[];
  edges: DiscoverGraphEdge[];
  selectedId: string | null;
  onSelect: (node: DiscoverGraphNode) => void;
  signedIn: boolean;
  live: boolean;
};

function primaryActions(node: DiscoverGraphNode, edges: DiscoverGraphEdge[]): DiscoverAction[] {
  return bubbleOperatorActions(node, edges).slice(0, 3);
}

export function DiscoverValueNodeStrip({
  nodes,
  edges,
  selectedId,
  onSelect,
  signedIn,
  live,
}: DiscoverValueNodeStripProps) {
  const sorted = [...nodes]
    .filter((n) => n.id !== "pool:ledger")
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 12);

  if (!sorted.length) return null;

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sorted.map((node) => {
          const domain = graphDomainForNode(node);
          const tint =
            domain === "other" ? "#94a3b8" : tintForDomain(domain);
          const selected = selectedId === node.id;
          const valueLabel =
            node.amountVerified && node.moneyGapUsd != null && node.moneyGapUsd > 0
              ? `$${node.moneyGapUsd.toFixed(0)}`
              : node.pendingFunding
                ? "Pending"
                : node.synthetic
                  ? "Preview"
                  : live
                    ? "Verified"
                    : "—";

          return (
            <button
              key={node.id}
              type="button"
              onClick={() => onSelect(node)}
              className={clsx(
                "discover-value-node-card shrink-0 text-left",
                selected && "discover-value-node-card--selected",
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: tint }}
                  aria-hidden
                />
                <span className="truncate text-sm font-medium text-white">{node.label}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="discover-value-node-card__tag">
                  {TYPE_LABEL[node.type] ?? node.type}
                </span>
                <span
                  className={clsx(
                    "discover-value-node-card__tag",
                    node.synthetic && "text-resolve-muted",
                    node.amountVerified && "text-amber-200/90",
                  )}
                >
                  {valueLabel}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {selectedId && (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
          {(() => {
            const node = sorted.find((n) => n.id === selectedId) ?? nodes.find((n) => n.id === selectedId);
            if (!node) return null;
            const actions = primaryActions(node, edges);
            return (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
                  Actions for {node.label}
                </p>
                <DiscoverInlineActionBar
                  actions={actions}
                  signedIn={signedIn}
                  surface="value-node-strip"
                  className="mt-2"
                />
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
