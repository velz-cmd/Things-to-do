"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { X } from "lucide-react";
import type { DiscoverGraphNode } from "@/lib/discover/radar";
import type { DiscoverAction } from "@/lib/discover/types";
import type { AutomationTrigger } from "@/lib/automation/types";
import {
  buildBubbleOperatorSurface,
  type BubbleOperatorMetrics,
} from "@/lib/discover/bubble-operator-surface";
import { DiscoverBubblemapMetrics } from "@/components/resolve/discover/discover-bubblemap-metrics";
import { DiscoverSourceBadge } from "@/components/resolve/discover/discover-source-badge";
import { DiscoverAutomationRuleBuilder } from "@/components/resolve/discover/discover-automation-rule-builder";
import { DiscoverCommunityConsoleActions } from "@/components/resolve/discover/discover-community-console-actions";
import { useSignInModal } from "@/components/auth/sign-in-context";
import type { CommunityConsoleTab } from "@/components/resolve/discover/discover-community-console-provider";
import { DiscoverInlineActionBar } from "@/components/resolve/discover/discover-inline-action-bar";
import { actionExecutionTruth, AUTOMATE_TAB } from "@/lib/discover/discover-action-truth";
import { whyForNodeType } from "@/lib/discover/resolve-value-copy";

export type BubbleOperatorAnchor = {
  node: DiscoverGraphNode;
};

type DiscoverBubbleOperatorPanelProps = {
  anchor: BubbleOperatorAnchor | null;
  actions: DiscoverAction[];
  nodes: DiscoverGraphNode[];
  edges: import("@/lib/discover/radar").DiscoverGraphEdge[];
  metrics: BubbleOperatorMetrics | null;
  signedIn: boolean;
  initialTab?: CommunityConsoleTab;
  automationTrigger?: AutomationTrigger;
  onClose: () => void;
};

export function DiscoverBubbleOperatorPanel({
  anchor,
  actions,
  nodes,
  edges,
  metrics,
  signedIn,
  initialTab = "console",
  automationTrigger,
  onClose,
}: DiscoverBubbleOperatorPanelProps) {
  const { openSignIn } = useSignInModal();
  const [tab, setTab] = useState<CommunityConsoleTab>(initialTab);

  useEffect(() => {
    if (!anchor) return;
    setTab(initialTab);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [anchor, onClose, initialTab]);

  const surface = useMemo(() => {
    if (!anchor) return null;
    return buildBubbleOperatorSurface({
      node: anchor.node,
      nodes,
      edges,
      metrics,
    });
  }, [anchor, nodes, edges, metrics]);

  if (!anchor || !surface) return null;

  const { node } = anchor;
  const isEcosystem = node.type === "ecosystem" || node.type === "repository";
  const slug = node.communitySlug;

  return (
    <>
      <button
        type="button"
        aria-label="Close operator panel"
        className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-white/10 bg-[#060a12] shadow-2xl sm:max-w-lg"
        role="dialog"
        aria-label={`Community console for ${node.label}`}
      >
        <header className="border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-calm-periwinkle">
                Community console
              </p>
              <h2 className="mt-1 truncate text-lg font-semibold text-white">
                {isEcosystem ? "⬡ " : ""}
                {node.label}
              </h2>
              <p className="mt-0.5 text-xs capitalize text-resolve-muted">{node.type}</p>
              <p className="mt-2 text-[11px] leading-relaxed text-resolve-calm-periwinkle/90">
                {whyForNodeType(node.type)}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg border border-white/10 p-1.5 text-resolve-muted hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <StatPill label="Weight" value={surface.stats.weight} />
            <StatPill
              label="Value"
              value={surface.stats.moneyLabel}
              highlight={surface.stats.moneyTone === "verified"}
            />
            <StatPill label="Status" value={surface.stats.statusLabel} />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {node.dataSource && <DiscoverSourceBadge source={node.dataSource} />}
            {node.synthetic && (
              <span className="rounded border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[9px] text-amber-200/90">
                Preview — not ledger yet
              </span>
            )}
            {!node.synthetic && node.amountVerified && (
              <span className="rounded border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] text-emerald-300">
                Ledger verified
              </span>
            )}
          </div>

          {actions.length > 0 && (
            <div className="mt-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
                Do this now
              </p>
              <DiscoverInlineActionBar
                actions={actions}
                signedIn={signedIn}
                surface="bubble-operator-panel"
                onAction={(action) => {
                  if (action.kind === "automate") setTab("automate");
                  else if (action.kind !== "open") onClose();
                }}
                className="mt-2"
              />
              {actions[0] && (
                <p className="mt-2 text-[10px] leading-relaxed text-resolve-muted-dim">
                  {actionExecutionTruth(actions[0].kind).detail}
                </p>
              )}
            </div>
          )}
        </header>

        <div className="flex border-b border-white/[0.06] px-5">
          <TabButton active={tab === "console"} onClick={() => setTab("console")}>
            Console
          </TabButton>
          <TabButton active={tab === "automate"} onClick={() => setTab("automate")}>
            {AUTOMATE_TAB.label}
          </TabButton>
          <TabButton active={tab === "advanced"} onClick={() => setTab("advanced")}>
            Advanced
          </TabButton>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === "console" ? (
            <div className="space-y-5">
              {slug && (
                <DiscoverCommunityConsoleActions
                  node={node}
                  signedIn={signedIn}
                  onObserve={() => setTab("advanced")}
                  onSimulate={() => setTab("automate")}
                />
              )}

              {surface.sections.map((section) => (
                <section key={section.id}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
                    {section.title}
                  </p>
                  <ul className="mt-2 space-y-2">
                    {section.items.map((item, i) => (
                      <li
                        key={`${section.id}-${i}`}
                        className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2"
                      >
                        <p className="text-[11px] font-medium text-white">{item.label}</p>
                        <p
                          className={clsx(
                            "mt-0.5 text-[11px] leading-relaxed",
                            item.tone === "warn"
                              ? "text-amber-200/90"
                              : item.tone === "ok"
                                ? "text-emerald-300/90"
                                : "text-resolve-muted",
                          )}
                        >
                          {item.detail}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : tab === "automate" ? (
            slug ? (
              <div className="space-y-3">
                <p className="text-xs leading-relaxed text-resolve-muted">
                  {AUTOMATE_TAB.hint} Arc USDC moves only after a verified sensor event — never on a timer alone.
                </p>
                <DiscoverAutomationRuleBuilder
                communitySlug={slug}
                signedIn={signedIn}
                initialTrigger={automationTrigger}
                onSignIn={openSignIn}
              />
              </div>
            ) : (
              <p className="text-xs text-resolve-muted">
                Install a community to create automation rules tied to authorization ingest.
              </p>
            )
          ) : (
            <div className="space-y-4">
              {surface.nodeMetrics ? (
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-resolve-muted-dim">
                    Structural importance (this node)
                  </p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums text-white">
                    {(surface.nodeMetrics.pageRank * 100).toFixed(1)}%
                    <span className="ml-1 text-sm font-normal text-resolve-muted">PageRank share</span>
                  </p>
                  <p className="mt-2 text-[11px] text-resolve-muted">{surface.nodeMetrics.evidence}</p>
                </div>
              ) : (
                <p className="text-xs text-resolve-muted">
                  Metrics update as ledger authorizations grow.
                </p>
              )}
              {surface.observatoryHref && (
                <Link
                  href={surface.observatoryHref}
                  className="inline-flex text-xs text-resolve-accent hover:underline"
                  onClick={onClose}
                >
                  Full observatory (optional) →
                </Link>
              )}
              {metrics && (
                <DiscoverBubblemapMetrics
                  metrics={metrics}
                  nodes={nodes}
                  className="border-t-0 p-0 sm:grid-cols-1"
                />
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function StatPill({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/25 px-2 py-2 text-center">
      <p className="text-[9px] uppercase tracking-wide text-resolve-muted-dim">{label}</p>
      <p
        className={clsx(
          "mt-0.5 truncate text-sm font-semibold tabular-nums",
          highlight ? "text-amber-200" : "text-white",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "border-b-2 px-3 py-2.5 text-[11px] font-medium transition",
        active
          ? "border-resolve-accent text-white"
          : "border-transparent text-resolve-muted hover:text-white",
      )}
    >
      {children}
    </button>
  );
}
