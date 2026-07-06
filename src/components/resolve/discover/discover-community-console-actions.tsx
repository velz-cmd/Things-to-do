"use client";

import { useState } from "react";
import clsx from "clsx";
import { Eye, Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { useDiscoverActions } from "@/components/resolve/discover/discover-actions-provider";
import type { DiscoverGraphNode } from "@/lib/discover/radar";

type ConsoleActionId = "observe" | "simulate" | "fund";

const ACTIONS: {
  id: ConsoleActionId;
  label: string;
  badge: string;
  icon: typeof Eye;
}[] = [
  { id: "fund", label: "Fund pool", badge: "Discover", icon: Play },
  { id: "observe", label: "Metrics", badge: "View", icon: Eye },
  { id: "simulate", label: "Autopay preview", badge: "Read-only", icon: Play },
];

type Props = {
  node: DiscoverGraphNode;
  signedIn: boolean;
  onObserve?: () => void;
  onSimulate?: () => void;
};

export function DiscoverCommunityConsoleActions({
  node,
  signedIn,
  onObserve,
  onSimulate,
}: Props) {
  const { runAction } = useDiscoverActions();
  const [pendingId, setPendingId] = useState<ConsoleActionId | null>(null);
  const slug = node.communitySlug;

  if (!slug) {
    return (
      <p className="text-xs text-resolve-muted">
        Install a community on this node to view the communal pool.
      </p>
    );
  }

  async function handleAction(id: ConsoleActionId) {
    if (id === "observe") {
      onObserve?.();
      return;
    }
    if (id === "simulate") {
      onSimulate?.();
      toast.message("Autopay at milestone", {
        description: "Communal pools settle automatically — no manual payout on Discover.",
      });
      return;
    }

    if (!signedIn) {
      toast.error("Sign in to fund the communal pool");
      return;
    }

    setPendingId(id);
    try {
      await runAction(
        {
          id: `console-fund-${slug}`,
          label: "Fund communal pool",
          kind: "fund",
          communitySlug: slug,
          amountUsd: 25,
        },
        "community-console",
      );
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
        Communal pool
      </p>
      <p className="text-[10px] leading-relaxed text-resolve-muted-dim">
        Fund only — payouts autopay at milestone. No program creation here.
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ACTIONS.map((def) => {
          const Icon = def.icon;
          const loading = pendingId === def.id;
          return (
            <button
              key={def.id}
              type="button"
              disabled={pendingId !== null && !loading}
              onClick={() => void handleAction(def.id)}
              className={clsx(
                "flex shrink-0 items-start gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-left transition hover:border-white/15",
                loading && "opacity-70",
              )}
            >
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.05]">
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-medium text-white">{def.label}</span>
                <span className="block text-[10px] text-resolve-muted-dim">{def.badge}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
