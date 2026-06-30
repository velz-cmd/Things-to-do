"use client";

import clsx from "clsx";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import { DISCOVER_ROLES } from "@/lib/discover/role-filters";

export function DiscoverRoleFilters({
  value,
  onChange,
  className,
}: {
  value: DiscoverRole;
  onChange: (role: DiscoverRole) => void;
  className?: string;
}) {
  return (
    <div className={clsx("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="discover-muted text-[10px] font-semibold uppercase tracking-[0.2em]">
          I am a
        </span>
        {DISCOVER_ROLES.map((role) => {
          const active = value === role.id;
          return (
            <button
              key={role.id}
              type="button"
              title={role.hint}
              onClick={() => onChange(role.id)}
              className={clsx(
                "rounded-full border px-3 py-1 text-[11px] font-medium transition",
                active
                  ? "border-resolve-accent/50 bg-resolve-accent/15 text-resolve-accent"
                  : "border-slate-300/80 text-slate-600 hover:border-slate-400 hover:text-slate-900",
              )}
            >
              {role.label}
            </button>
          );
        })}
      </div>
      {value !== "all" && (
        <p className="discover-muted text-[11px]">
          {DISCOVER_ROLES.find((r) => r.id === value)?.hint}
        </p>
      )}
    </div>
  );
}
