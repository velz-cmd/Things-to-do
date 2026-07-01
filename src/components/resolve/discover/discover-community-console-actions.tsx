"use client";

import { useState } from "react";
import clsx from "clsx";
import { Eye, Gift, Loader2, Play, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { useDiscoverActions } from "@/components/resolve/discover/discover-actions-provider";
import type { DiscoverGraphNode } from "@/lib/discover/radar";
import type { ProgramTemplateId } from "@/lib/communities/catalog";

type ConsoleActionId = "bounty" | "grant" | "observe" | "simulate";

const ACTIONS: {
  id: ConsoleActionId;
  label: string;
  badge: string;
  icon: typeof ScrollText;
  templateId: ProgramTemplateId;
}[] = [
  { id: "bounty", label: "Docs bounty", badge: "Creates program", icon: ScrollText, templateId: "docs-bounty" },
  { id: "grant", label: "Grant pool", badge: "Creates program", icon: Gift, templateId: "quadratic-funding" },
  { id: "observe", label: "Metrics", badge: "View", icon: Eye, templateId: "docs-bounty" },
  { id: "simulate", label: "Test rule", badge: "Auto-pay", icon: Play, templateId: "docs-bounty" },
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
        Install a community on this node to unlock programs.
      </p>
    );
  }

  async function handleAction(id: ConsoleActionId) {
    const def = ACTIONS.find((a) => a.id === id)!;

    if (id === "observe") {
      onObserve?.();
      return;
    }
    if (id === "simulate") {
      onSimulate?.();
      return;
    }

    if (!signedIn) {
      toast.error("Sign in to create programs");
      return;
    }

    setPendingId(id);
    try {
      await runAction(
        {
          id: `console-${id}`,
          label: def.label,
          kind: "create_program",
          communitySlug: slug,
          templateId: def.templateId,
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
        Programs
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
                "discover-inline-action shrink-0 min-w-[7rem]",
                (def.id === "bounty" || def.id === "grant") && "discover-inline-action--primary",
                pendingId !== null && !loading && "opacity-50",
              )}
            >
              <span className="discover-inline-action__label inline-flex items-center gap-1">
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3" />}
                {def.label}
              </span>
              <span className="discover-inline-action__badge">{def.badge}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
