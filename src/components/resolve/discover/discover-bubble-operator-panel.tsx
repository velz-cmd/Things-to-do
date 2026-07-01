"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronUp, X } from "lucide-react";
import type { DiscoverGraphNode } from "@/lib/discover/radar";
import type { DiscoverAction } from "@/lib/discover/types";
import type { AutomationTrigger } from "@/lib/automation/types";
import {
  buildBubbleOperatorSurface,
  type BubbleOperatorMetrics,
} from "@/lib/discover/bubble-operator-surface";
import { DiscoverSourceBadge } from "@/components/resolve/discover/discover-source-badge";
import { DiscoverAutomationRuleBuilder } from "@/components/resolve/discover/discover-automation-rule-builder";
import { useSignInModal } from "@/components/auth/sign-in-context";
import type {
  CommunityConsoleTab,
  CommunityConsoleActionContext,
} from "@/components/resolve/discover/discover-community-console-provider";
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
  actionContext?: CommunityConsoleActionContext;
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
  actionContext,
  onClose,
}: DiscoverBubbleOperatorPanelProps) {
  const { openSignIn } = useSignInModal();
  const [expanded, setExpanded] = useState(initialTab !== "console");
  const [showAutomate, setShowAutomate] = useState(initialTab === "automate");

  useEffect(() => {
    if (!anchor) return;
    setExpanded(initialTab !== "console");
    setShowAutomate(initialTab === "automate");
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
  const slug = node.communitySlug;
  const contextHeadline =
    actionContext === "fund"
      ? "Funded — obligations clearing on Arc"
      : actionContext === "install"
        ? "Community attached — sensors sync in background"
        : actionContext === "create_program"
          ? "Program created — fund or automate next"
          : actionContext === "automate"
            ? "Set an auto-pay rule for verified events"
            : null;
  const needs = surface.sections.find((s) => s.id === "needs")?.items[0];
  const moneyIn = surface.sections.find((s) => s.id === "money")?.items[0];
  const program = surface.sections.find((s) => s.id === "programs")?.items[0];

  return (
    <>
      <button
        type="button"
        aria-label="Close operator panel"
        className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside
        className="fixed bottom-4 right-4 left-4 z-50 mx-auto flex max-h-[min(85vh,640px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#060a12] shadow-2xl sm:left-auto sm:max-w-lg"
        role="dialog"
        aria-label={`Actions for ${node.label}`}
      >
        <header className="shrink-0 border-b border-white/[0.06] px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-resolve-calm-periwinkle">
                Value node
              </p>
              <h2 className="mt-0.5 truncate text-base font-semibold text-white">{node.label}</h2>
              <p className="text-[10px] capitalize text-resolve-muted">{node.type}</p>
              {contextHeadline && (
                <p className="mt-1 text-[11px] font-medium text-emerald-300/90">{contextHeadline}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg border border-white/10 p-1.5 text-resolve-muted hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <StatPill label="Weight" value={surface.stats.weight} />
            <StatPill
              label="Value"
              value={surface.stats.moneyLabel}
              highlight={surface.stats.moneyTone === "verified"}
            />
            <StatPill label="Status" value={surface.stats.statusLabel} />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {node.dataSource && <DiscoverSourceBadge source={node.dataSource} />}
            {node.synthetic && (
              <span className="rounded border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[9px] text-amber-200/90">
                Preview
              </span>
            )}
            {!node.synthetic && node.amountVerified && (
              <span className="rounded border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] text-emerald-300">
                Ledger verified
              </span>
            )}
          </div>

          {actions.length > 0 && (
            <div className="mt-3">
              <DiscoverInlineActionBar
                actions={actions}
                signedIn={signedIn}
                surface="bubble-operator-panel"
                onAction={(action) => {
                  if (action.kind === "automate") {
                    setShowAutomate(true);
                    setExpanded(true);
                  } else if (action.kind !== "open") {
                    onClose();
                  }
                }}
              />
              {actions[0] && (
                <p className="mt-1.5 text-[10px] leading-relaxed text-resolve-muted-dim">
                  {actionExecutionTruth(actions[0].kind).detail}
                </p>
              )}
            </div>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <FlowTile
              tone="in"
              label="Signal"
              value={needs?.detail ?? whyForNodeType(node.type)}
            />
            <FlowTile
              tone="out"
              label={moneyIn?.label ?? "Capital"}
              value={moneyIn?.detail ?? surface.stats.moneyLabel}
            />
          </div>

          {program && (
            <p className="mt-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[11px] text-resolve-muted">
              <span className="font-medium text-white">{program.label}</span>
              <span className="text-resolve-muted-dim"> · </span>
              {program.detail}
            </p>
          )}

          {showAutomate && slug ? (
            <div className="mt-3 space-y-2 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
              <p className="text-[11px] text-resolve-muted">{AUTOMATE_TAB.hint}</p>
              <DiscoverAutomationRuleBuilder
                communitySlug={slug}
                signedIn={signedIn}
                initialTrigger={automationTrigger}
                onSignIn={openSignIn}
              />
            </div>
          ) : null}

          {expanded && (
            <div className="mt-3 space-y-2">
              {surface.sections
                .filter((s) => s.id !== "needs" && s.id !== "programs" && s.id !== "money")
                .map((section) => (
                  <section key={section.id}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
                      {section.title}
                    </p>
                    <ul className="mt-1 space-y-1">
                      {section.items.slice(0, 3).map((item, i) => (
                        <li
                          key={`${section.id}-${i}`}
                          className="rounded-lg border border-white/[0.05] bg-black/20 px-2.5 py-1.5 text-[11px] text-resolve-muted"
                        >
                          <span className="font-medium text-white">{item.label}</span>
                          <span className="text-resolve-muted-dim"> — </span>
                          {item.detail}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              {surface.nodeMetrics && (
                <p className="text-[11px] text-resolve-muted">
                  PageRank {(surface.nodeMetrics.pageRank * 100).toFixed(1)}% ·{" "}
                  {surface.nodeMetrics.evidence}
                </p>
              )}
              {surface.observatoryHref && (
                <Link
                  href={surface.observatoryHref}
                  className="inline-flex text-[11px] text-resolve-accent hover:underline"
                  onClick={onClose}
                >
                  Full observatory →
                </Link>
              )}
            </div>
          )}
        </div>

        <footer className="shrink-0 border-t border-white/[0.06] px-4 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {slug ? (
              <button
                type="button"
                onClick={() => {
                  setShowAutomate((v) => !v);
                  setExpanded(true);
                }}
                className="text-[11px] font-medium text-resolve-accent hover:underline"
              >
                {showAutomate ? "Hide auto-pay" : AUTOMATE_TAB.label}
              </button>
            ) : (
              <span className="text-[11px] text-resolve-muted-dim">Install a community to automate</span>
            )}
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex items-center gap-1 text-[11px] text-resolve-muted hover:text-white"
            >
              {expanded ? (
                <>
                  Less detail <ChevronUp className="h-3 w-3" />
                </>
              ) : (
                <>
                  More detail <ChevronDown className="h-3 w-3" />
                </>
              )}
            </button>
          </div>
        </footer>
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
    <div className="rounded-lg border border-white/[0.06] bg-black/25 px-2 py-1.5 text-center">
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

function FlowTile({
  tone,
  label,
  value,
}: {
  tone: "in" | "out";
  label: string;
  value: string;
}) {
  const Icon = tone === "in" ? ArrowDownLeft : ArrowUpRight;
  return (
    <div
      className={clsx(
        "rounded-lg border px-3 py-2",
        tone === "in"
          ? "border-emerald-500/20 bg-emerald-500/5"
          : "border-white/[0.08] bg-white/[0.03]",
      )}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-resolve-muted-dim">
        <Icon className={clsx("h-3 w-3", tone === "in" ? "text-emerald-400" : "text-resolve-muted")} />
        {label}
      </div>
      <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-resolve-muted">{value}</p>
    </div>
  );
}
