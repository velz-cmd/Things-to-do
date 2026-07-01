"use client";

import clsx from "clsx";
import {
  DISCOVER_NEED_TYPES,
  type DiscoverNeedTypeFilter,
} from "@/lib/discover/need-types";

export function DiscoverNeedTypeFilters({
  value,
  onChange,
  className,
}: {
  value: DiscoverNeedTypeFilter;
  onChange: (needType: DiscoverNeedTypeFilter) => void;
  className?: string;
}) {
  return (
    <div className={clsx("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-muted">
          Need type
        </span>
        <button
          type="button"
          onClick={() => onChange("all")}
          className={clsx(
            "discover-chip rounded-full border px-3 py-1 text-[11px] font-medium transition",
            value === "all" && "discover-chip--active",
          )}
        >
          All
        </button>
        {DISCOVER_NEED_TYPES.map((need) => {
          const active = value === need.id;
          return (
            <button
              key={need.id}
              type="button"
              title={need.hint}
              onClick={() => onChange(need.id)}
              className={clsx(
                "discover-chip rounded-full border px-3 py-1 text-[11px] font-medium transition",
                active && "discover-chip--active",
              )}
            >
              {need.label}
            </button>
          );
        })}
      </div>
      {value !== "all" && (
        <p className="text-[11px] text-resolve-muted-dim">
          {DISCOVER_NEED_TYPES.find((n) => n.id === value)?.hint}
        </p>
      )}
    </div>
  );
}
