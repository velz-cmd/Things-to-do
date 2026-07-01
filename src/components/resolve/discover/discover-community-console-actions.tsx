"use client";

import { useState } from "react";
import clsx from "clsx";
import {
  Coins,
  Eye,
  Gift,
  Loader2,
  Mail,
  Play,
  ScrollText,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useDiscoverActions } from "@/components/resolve/discover/discover-actions-provider";
import type { DiscoverGraphNode } from "@/lib/discover/radar";
import type { ProgramTemplateId } from "@/lib/communities/catalog";

type ConsoleActionId =
  | "payroll"
  | "grant"
  | "bounty"
  | "invite"
  | "observe"
  | "simulate";

const ACTIONS: {
  id: ConsoleActionId;
  label: string;
  icon: typeof Coins;
  templateId: ProgramTemplateId;
  description: string;
}[] = [
  {
    id: "payroll",
    label: "Create payroll",
    icon: Users,
    templateId: "security-fund",
    description: "Maintainer retainer program",
  },
  {
    id: "grant",
    label: "Create grant",
    icon: Gift,
    templateId: "quadratic-funding",
    description: "QF match pool",
  },
  {
    id: "bounty",
    label: "Create bounty",
    icon: ScrollText,
    templateId: "docs-bounty",
    description: "Docs merge rewards",
  },
  {
    id: "invite",
    label: "Invite",
    icon: Mail,
    templateId: "docs-bounty",
    description: "Share install link",
  },
  {
    id: "observe",
    label: "Observe",
    icon: Eye,
    templateId: "docs-bounty",
    description: "Health + live authorizations",
  },
  {
    id: "simulate",
    label: "Simulate",
    icon: Play,
    templateId: "docs-bounty",
    description: "Project rule spend",
  },
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
  const { runAction, busy } = useDiscoverActions();
  const [inviteCopied, setInviteCopied] = useState(false);
  const slug = node.communitySlug;

  if (!slug) {
    return (
      <p className="text-xs text-resolve-muted">
        Install a community on this node to unlock console actions.
      </p>
    );
  }

  async function handleAction(id: ConsoleActionId) {
    const def = ACTIONS.find((a) => a.id === id)!;
    const origin = typeof window !== "undefined" ? window.location.origin : "";

    switch (id) {
      case "invite": {
        const url = `${origin}/discover?community=${slug}`;
        try {
          await navigator.clipboard.writeText(url);
          setInviteCopied(true);
          toast.success("Invite link copied", { description: url });
          setTimeout(() => setInviteCopied(false), 2000);
        } catch {
          toast.error("Could not copy invite link");
        }
        return;
      }
      case "observe":
        onObserve?.();
        return;
      case "simulate":
        onSimulate?.();
        return;
      case "payroll":
      case "grant":
      case "bounty":
        if (!signedIn) {
          toast.error("Sign in to create programs");
          return;
        }
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
        break;
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
        Create · operate
      </p>
      <div className="grid grid-cols-2 gap-2">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          const isInvite = action.id === "invite" && inviteCopied;
          return (
            <button
              key={action.id}
              type="button"
              disabled={busy}
              onClick={() => void handleAction(action.id)}
              className={clsx(
                "flex flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left transition",
                action.id === "bounty" || action.id === "grant"
                  ? "border-emerald-500/25 bg-emerald-500/[0.06] hover:bg-emerald-500/10"
                  : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.05]",
              )}
            >
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-white">
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Icon className="h-3.5 w-3.5 text-resolve-accent" />
                )}
                {isInvite ? "Copied!" : action.label}
              </span>
              <span className="text-[10px] text-resolve-muted">{action.description}</span>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-resolve-muted-dim">
        Programs stay on Discover — no tab hopping to /communities.
      </p>
    </div>
  );
}
