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
import { CONSOLE_CREATE_ACTIONS } from "@/lib/discover/resolve-value-copy";

type ConsoleActionId =
  | "payroll"
  | "grant"
  | "bounty"
  | "invite"
  | "observe"
  | "simulate";

const ACTION_META: Record<
  ConsoleActionId,
  { icon: typeof Coins; templateId: ProgramTemplateId }
> = {
  payroll: { icon: Users, templateId: "security-fund" },
  grant: { icon: Gift, templateId: "quadratic-funding" },
  bounty: { icon: ScrollText, templateId: "docs-bounty" },
  invite: { icon: Mail, templateId: "docs-bounty" },
  observe: { icon: Eye, templateId: "docs-bounty" },
  simulate: { icon: Play, templateId: "docs-bounty" },
};

const ACTION_IDS: ConsoleActionId[] = [
  "payroll",
  "grant",
  "bounty",
  "invite",
  "observe",
  "simulate",
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
  const [inviteCopied, setInviteCopied] = useState(false);
  const [pendingId, setPendingId] = useState<ConsoleActionId | null>(null);
  const slug = node.communitySlug;

  if (!slug) {
    return (
      <p className="text-xs text-resolve-muted">
        Install a community on this node to unlock console actions.
      </p>
    );
  }

  async function handleAction(id: ConsoleActionId) {
    const def = CONSOLE_CREATE_ACTIONS[ACTION_IDS.indexOf(id)];
    const meta = ACTION_META[id];
    const origin = typeof window !== "undefined" ? window.location.origin : "";

    if (id === "invite" || id === "observe" || id === "simulate") {
      if (id === "invite") {
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
      if (id === "observe") {
        onObserve?.();
        return;
      }
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
          reason: def.why,
          communitySlug: slug,
          templateId: meta.templateId,
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
        Create · operate
      </p>
      <div className="grid grid-cols-2 gap-2">
        {ACTION_IDS.map((id, index) => {
          const def = CONSOLE_CREATE_ACTIONS[index];
          const Icon = ACTION_META[id].icon;
          const loading = pendingId === id;
          const isInvite = id === "invite" && inviteCopied;
          return (
            <button
              key={id}
              type="button"
              disabled={pendingId !== null && !loading}
              onClick={() => void handleAction(id)}
              title={def.why}
              className={clsx(
                "flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left transition",
                id === "bounty" || id === "grant"
                  ? "border-emerald-500/25 bg-emerald-500/[0.06] hover:bg-emerald-500/10"
                  : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.05]",
                pendingId !== null && !loading && "opacity-50",
              )}
            >
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-white">
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-resolve-accent" />
                ) : (
                  <Icon className="h-3.5 w-3.5 text-resolve-accent" />
                )}
                {isInvite ? "Copied!" : def.label}
              </span>
              <span className="text-[10px] text-resolve-muted">{def.description}</span>
              <span className="text-[9px] leading-snug text-resolve-muted-dim">{def.why}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
