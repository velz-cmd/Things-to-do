"use client";

import { Bot, ChevronDown, Receipt, Users, Zap } from "lucide-react";
import { formatAgentPrice } from "@/lib/agent/agent-signal-format";
import { MISSION_HIRE_INTEL } from "@/lib/mission/mission-lane-copy";

const ICONS = [Zap, Users, Receipt] as const;

export function MissionIntelValuePanel({
  onTryExample,
  loading,
}: {
  onTryExample: (prompt: string) => void;
  loading?: boolean;
}) {
  return (
    <details className="mission-panel mission-intel-panel">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-resolve-muted">
          <Bot className="h-3.5 w-3.5 text-violet-300" aria-hidden />
          {MISSION_HIRE_INTEL.title}
        </span>
        <ChevronDown className="h-3.5 w-3.5 opacity-50" />
      </summary>

      <div className="space-y-3 border-t border-white/[0.06] px-4 py-3">
        <p className="text-sm leading-relaxed text-white/90">{MISSION_HIRE_INTEL.lead}</p>
        <ul className="space-y-2">
          {MISSION_HIRE_INTEL.bullets.map((bullet, i) => {
            const Icon = ICONS[i] ?? Zap;
            return (
              <li key={bullet} className="flex gap-2 text-xs leading-relaxed text-resolve-muted">
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-300/90" aria-hidden />
                <span>{bullet}</span>
              </li>
            );
          })}
        </ul>
        <p className="text-[11px] leading-relaxed text-violet-200/75">{MISSION_HIRE_INTEL.compare}</p>

        <ul className="space-y-1.5 pt-1">
          {MISSION_HIRE_INTEL.examples.map((ex) => (
            <li key={ex.label}>
              <button
                type="button"
                disabled={loading}
                onClick={() => onTryExample(ex.prompt)}
                className="mission-agent-row disabled:opacity-40"
              >
                <span className="text-sm text-white/90">{ex.label}</span>
                <span className="text-xs font-semibold tabular-nums text-emerald-300">
                  {formatAgentPrice(ex.price)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
