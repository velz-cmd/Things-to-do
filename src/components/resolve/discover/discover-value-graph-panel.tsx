"use client";

import clsx from "clsx";
import Link from "next/link";
import { X } from "lucide-react";
import type { DiscoverGraphNode } from "@/lib/discover/radar";
import type { DiscoverAction } from "@/lib/discover/types";
import { DiscoverSourceBadge } from "@/components/resolve/discover/discover-source-badge";
import { formatDiscoverMoney } from "@/lib/discover/money-display";
import { filterActionsByIntent } from "@/lib/discover/intent-filters";
import type { DiscoverIntent } from "@/lib/discover/types";
import { useDiscoverActions } from "@/components/resolve/discover/discover-actions-provider";

type DiscoverValueGraphPanelProps = {
  node: DiscoverGraphNode | null;
  intent: DiscoverIntent;
  onClose: () => void;
};

export function DiscoverValueGraphPanel({ node, intent, onClose }: DiscoverValueGraphPanelProps) {
  const { runAction } = useDiscoverActions();

  if (!node) return null;

  const money = formatDiscoverMoney(node.moneyGapUsd, node.amountVerified ?? false, node.dataSource);
  const actions = filterActionsByIntent(node.actions ?? [], intent);

  return (
    <>
      <button
        type="button"
        aria-label="Close panel"
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside
        className={clsx(
          "fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-white/10 bg-[#060a12] shadow-2xl",
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-accent">
              Value graph node
            </p>
            <h2 className="mt-1 text-lg font-semibold text-white">{node.label}</h2>
            <p className="mt-1 text-xs capitalize text-resolve-muted">{node.type}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 p-1.5 text-resolve-muted hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {node.whyItMatters && (
            <section>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
                Why it matters
              </p>
              <p className="mt-1 text-sm text-resolve-muted">{node.whyItMatters}</p>
            </section>
          )}

          <section className="flex flex-wrap items-center gap-2">
            {node.dataSource && <DiscoverSourceBadge source={node.dataSource} />}
            <span className="text-[10px] text-resolve-muted-dim">
              Weight {node.weight.toFixed(2)}
            </span>
          </section>

          <section>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
              Money gap
            </p>
            <p
              className={clsx(
                "mt-1 text-xl font-semibold tabular-nums",
                money.tone === "verified" ? "text-amber-200" : "text-resolve-muted",
              )}
            >
              {money.label}
            </p>
          </section>

          {node.updatedAt && (
            <section>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
                Last updated
              </p>
              <p className="mt-1 text-xs text-resolve-muted">
                {new Date(node.updatedAt).toLocaleString()}
              </p>
            </section>
          )}

          {node.proofHref && (
            <section>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
                Proof
              </p>
              <Link href={node.proofHref} className="mt-1 text-sm text-resolve-accent hover:underline">
                View proof →
              </Link>
            </section>
          )}

          <section>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
              Available actions
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {actions.length ? (
                actions.map((action) => (
                  <ActionButton
                    key={action.id}
                    action={action}
                    onRun={() => void runAction(action, "value-graph-panel")}
                  />
                ))
              ) : (
                <p className="text-xs text-resolve-muted">No actions for current intent.</p>
              )}
            </div>
          </section>
        </div>
      </aside>
    </>
  );
}

function ActionButton({ action, onRun }: { action: DiscoverAction; onRun: () => void }) {
  return (
    <button
      type="button"
      onClick={onRun}
      className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-resolve-muted transition hover:text-white"
    >
      {action.label}
    </button>
  );
}
