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
    <div className={clsx("discover-on-canvas space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="discover-muted text-[10px] font-semibold uppercase tracking-[0.2em]">
          Need type
        </span>
        <button
          type="button"
          onClick={() => onChange("all")}
          className={clsx(
            "rounded-full border px-3 py-1 text-[11px] font-medium transition",
            value === "all"
              ? "border-resolve-calm-periwinkle/50 bg-white text-slate-800 shadow-sm"
              : "border-slate-300/80 bg-white/80 text-slate-600 hover:border-slate-400 hover:text-slate-900",
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
                "rounded-full border px-3 py-1 text-[11px] font-medium transition",
                active
                  ? "border-resolve-calm-blue/50 bg-white text-slate-800 shadow-sm"
                  : "border-slate-300/80 bg-white/80 text-slate-600 hover:border-slate-400 hover:text-slate-900",
              )}
            >
              {need.label}
            </button>
          );
        })}
      </div>
      {value !== "all" && (
        <p className="discover-muted text-[11px]">
          {DISCOVER_NEED_TYPES.find((n) => n.id === value)?.hint}
        </p>
      )}
    </div>
  );
}
