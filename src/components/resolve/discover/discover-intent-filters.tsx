"use client";

import clsx from "clsx";
import type { DiscoverIntent } from "@/lib/discover/types";
import { DISCOVER_INTENTS } from "@/lib/discover/intent-filters";

export function DiscoverIntentFilters({
  value,
  onChange,
  className,
}: {
  value: DiscoverIntent;
  onChange: (intent: DiscoverIntent) => void;
  className?: string;
}) {
  return (
    <div className={clsx("flex flex-wrap items-center gap-2", className)}>
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-muted-dim">
        I want to
      </span>
      {DISCOVER_INTENTS.map((intent) => {
        const active = value === intent.id;
        return (
          <button
            key={intent.id}
            type="button"
            title={intent.hint}
            onClick={() => onChange(intent.id)}
            className={clsx(
              "rounded-full border px-3 py-1 text-[11px] font-medium transition",
              active
                ? "border-resolve-accent/50 bg-resolve-accent/15 text-resolve-accent"
                : "border-resolve-border/60 text-resolve-muted hover:text-white",
            )}
          >
            {intent.label}
          </button>
        );
      })}
    </div>
  );
}
