"use client";

import clsx from "clsx";
import { History } from "lucide-react";
import { BlueGlowCard } from "@/components/resolve/ui/blue-glow-card";
import { Money } from "@/components/resolve/ui/money";
import type { EconomicMemoryEntry } from "@/lib/communities/economic-memory";

const PHASE_LABELS: Record<EconomicMemoryEntry["phase"], string> = {
  fund: "Fund",
  authorize: "Authorize",
  deploy: "Deploy",
  outcome: "Outcome",
  observe: "Observe",
};

const PHASE_COLORS: Record<EconomicMemoryEntry["phase"], string> = {
  fund: "bg-blue-500/20 text-blue-300",
  authorize: "bg-violet-500/20 text-violet-300",
  deploy: "bg-amber-500/20 text-amber-200",
  outcome: "bg-emerald-500/20 text-emerald-300",
  observe: "bg-white/10 text-resolve-muted",
};

/** Funding → outcome over time */
export function EconomicMemoryTimeline({ entries }: { entries: EconomicMemoryEntry[] }) {
  if (!entries.length) {
    return (
      <BlueGlowCard variant="subtle" className="text-sm text-resolve-muted">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4" />
          <span>Economic memory will appear after install, scrobbles, and deploy.</span>
        </div>
      </BlueGlowCard>
    );
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-white">Economic memory</h2>
      <p className="mt-1 text-xs text-resolve-muted">Funding → authorization → settlement → outcome</p>
      <ol className="relative mt-4 space-y-0 border-l border-white/[0.08] pl-4">
        {entries.map((e, idx) => (
          <li key={e.id} className="relative pb-5 last:pb-0">
            <span
              className={clsx(
                "absolute -left-[1.35rem] top-1 flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold",
                PHASE_COLORS[e.phase],
              )}
            >
              {idx + 1}
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-resolve-muted">
                  {PHASE_LABELS[e.phase]}
                </span>
                <p className="text-sm text-white">{e.title}</p>
                {e.detail && <p className="mt-0.5 text-xs text-resolve-muted">{e.detail}</p>}
              </div>
              <div className="text-right">
                {e.amountUsd != null && e.amountUsd > 0 && (
                  <Money amount={e.amountUsd} size="sm" className="text-emerald-300" />
                )}
                <time className="block text-[10px] text-resolve-muted-dim">
                  {new Date(e.at).toLocaleString()}
                </time>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
