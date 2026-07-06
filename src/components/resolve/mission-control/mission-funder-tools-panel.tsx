"use client";

import { ChevronDown, LineChart } from "lucide-react";
import { MISSION_FUNDER_INTENTS } from "@/lib/mission/mission-lane-copy";
import { MissionTemplateTiles } from "@/components/resolve/mission-control/mission-template-tiles";
import { MissionIntelValuePanel } from "@/components/resolve/mission-control/mission-intel-value-panel";

export function MissionFunderToolsPanel({
  onSubmit,
  loading,
}: {
  onSubmit: (prompt: string) => void;
  loading?: boolean;
}) {
  return (
    <details className="mission-panel">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-resolve-muted">
          <LineChart className="h-3.5 w-3.5 text-sky-300" aria-hidden />
          For funders & pool operators
        </span>
        <ChevronDown className="h-3.5 w-3.5 opacity-50" />
      </summary>

      <div className="space-y-4 border-t border-white/[0.06] px-4 py-3">
        <p className="text-xs leading-relaxed text-resolve-muted">
          Simulate batches, hire intel, and authorize settlement when you have capital to deploy — not
          required for creators checking cents owed.
        </p>

        <div className="grid gap-2 sm:grid-cols-3">
          {MISSION_FUNDER_INTENTS.map((intent) => {
            const Icon = intent.icon;
            return (
              <button
                key={intent.id}
                type="button"
                disabled={loading}
                onClick={() => onSubmit(intent.prompt)}
                className="mission-intent-card mission-intent-card--compact disabled:opacity-40"
              >
                <span className="mission-intent-card__icon">
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.9} />
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block text-xs font-semibold text-white">{intent.label}</span>
                  <span className="mt-0.5 block text-[10px] leading-4 text-resolve-muted">
                    {intent.detail}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <MissionTemplateTiles onSubmit={onSubmit} />
        <MissionIntelValuePanel onTryExample={onSubmit} loading={loading} />
      </div>
    </details>
  );
}
