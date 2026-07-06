"use client";

import Link from "next/link";
import { ChevronDown, Link2, Sparkles, Wallet } from "lucide-react";
import { MISSION_CREATOR_VALUE } from "@/lib/mission/mission-lane-copy";

const ACTION_ICONS = [Wallet, Link2, Sparkles] as const;

export function MissionCreatorValuePanel({
  onTryPrompt,
  loading,
}: {
  onTryPrompt: (prompt: string) => void;
  loading?: boolean;
}) {
  return (
    <details className="mission-panel mission-creator-panel" open>
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-200/90">
          <Wallet className="h-3.5 w-3.5 text-emerald-300" aria-hidden />
          {MISSION_CREATOR_VALUE.title}
        </span>
        <ChevronDown className="h-3.5 w-3.5 opacity-50" />
      </summary>

      <div className="space-y-3 border-t border-white/[0.06] px-4 py-3">
        <p className="text-sm leading-relaxed text-white/90">{MISSION_CREATOR_VALUE.lead}</p>
        <ul className="space-y-2">
          {MISSION_CREATOR_VALUE.bullets.map((bullet) => (
            <li key={bullet} className="text-xs leading-relaxed text-resolve-muted">
              {bullet}
            </li>
          ))}
        </ul>

        <ul className="space-y-1.5">
          {MISSION_CREATOR_VALUE.actions.map((action, i) => {
            const Icon = ACTION_ICONS[i] ?? Wallet;
            return (
              <li key={action.id}>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => onTryPrompt(action.prompt)}
                  className="mission-agent-row disabled:opacity-40"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Icon className="h-3.5 w-3.5 shrink-0 text-emerald-300/90" aria-hidden />
                    <span className="min-w-0 text-left">
                      <span className="block text-sm text-white/90">{action.label}</span>
                      <span className="block text-[10px] text-resolve-muted-dim">{action.detail}</span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <p className="text-[11px] text-resolve-muted-dim">
          Already linked?{" "}
          <Link href={MISSION_CREATOR_VALUE.profileHref} className="text-sky-300 hover:underline">
            Open earnings on Profile
          </Link>
        </p>
      </div>
    </details>
  );
}
