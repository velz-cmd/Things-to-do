"use client";

import { X } from "lucide-react";
import { useMissionScope } from "@/lib/mission/mission-context";

/** When a mission is active, everything orbits that context — not separate pages. */
export function MissionScopeBar() {
  const { scope, setScope } = useMissionScope();

  if (!scope) return null;

  return (
    <div className="border-b border-resolve-accent/20 bg-gradient-to-r from-resolve-accent/10 via-violet-500/5 to-transparent">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 lg:px-8">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-accent/90">
            Mission scope
          </p>
          <p className="text-sm text-white">
            <span className="font-semibold">{scope.label}</span>
            {scope.kind === "repository" && (
              <span className="ml-2 text-xs text-resolve-muted">
                — graph, pool, and evidence unified
              </span>
            )}
            {scope.kind === "community" && (
              <span className="ml-2 text-xs text-resolve-muted">
                — program rails and settlement in Mission
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setScope(null)}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-resolve-muted transition hover:bg-resolve-hover/40 hover:text-white"
        >
          <X className="h-3 w-3" />
          Clear scope
        </button>
      </div>
    </div>
  );
}
