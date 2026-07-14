"use client";

import clsx from "clsx";
import type { DiscoverGraphNode } from "@/lib/discover/radar";
import type { DiscoverAction } from "@/lib/discover/types";
import { bubbleOperatorActions } from "@/lib/discover/graph-node-actions";
import type { DiscoverGraphEdge } from "@/lib/discover/radar";
import { graphDomainForNode, tintForDomain } from "@/lib/discover/graph-domain";
import { DiscoverInlineActionBar } from "@/components/resolve/discover/discover-inline-action-bar";
import { DiscoverSourceBadge } from "@/components/resolve/discover/discover-source-badge";
import styles from "./discover-workspace.module.css";

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

const TYPE_COLOR: Record<string, string> = {
  person: "#e4b755",
  creator: "#e4b755",
  mission: "#805fff",
  program: "#805fff",
  community: "#36d2ff",
  ecosystem: "#36d2ff",
  repository: "#36d2ff",
  treasury: "#369cff",
  capital: "#369cff",
  settlement: "#3bd7a5",
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
      <div className={styles.graphNodeRail}>
        {sorted.map((node) => {
          const domain = graphDomainForNode(node);
          const tint = TYPE_COLOR[node.type] ?? (domain === "other" ? "#94a3b8" : tintForDomain(domain));
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
                styles.graphNodeCard,
                "shrink-0 text-left",
                selected && styles.graphNodeSelected,
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
        <div className={styles.graphSummary}>
          {(() => {
            const node = sorted.find((n) => n.id === selectedId) ?? nodes.find((n) => n.id === selectedId);
            if (!node) return null;
            const actions = primaryActions(node, edges);
            return (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-violet-200">Selected entity</p>
                    <p className="mt-1 text-sm font-semibold text-white">{node.label}</p>
                    <p className="mt-1 text-[10px] text-resolve-muted">
                      {TYPE_LABEL[node.type] ?? node.type}
                      {node.programId ? ` · Program ${node.programId}` : ""}
                      {node.amountVerified ? " · Verified evidence" : node.synthetic ? " · Preview" : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {node.dataSource && <DiscoverSourceBadge source={node.dataSource} />}
                    {node.moneyGapUsd != null && node.moneyGapUsd > 0 && (
                      <span className="font-mono text-[11px] text-amber-200">${node.moneyGapUsd.toFixed(2)} recognized</span>
                    )}
                  </div>
                </div>
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
