"use client";

import { X } from "lucide-react";
import { useMissionScope } from "@/lib/mission/mission-context";

/** When a mission is active, everything orbits that context — not separate pages. */
export function MissionScopeBar() {
  const { scope, setScope } = useMissionScope();

  if (!scope) return null;

  return (
    <div className="border-b border-resolve-accent/20 bg-resolve-accent/5">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-2 lg:px-8">
        <p className="text-xs text-resolve-muted">
          Mission scope:{" "}
          <span className="font-semibold text-white">{scope.label}</span>
          {scope.kind === "repository" && (
            <span className="ml-2 text-resolve-muted-dim">— graph, treasury, and evidence unified</span>
          )}
        </p>
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
