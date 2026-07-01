"use client";

import clsx from "clsx";
import { SlidersHorizontal } from "lucide-react";
import { DiscoverNeedTypeFilters } from "@/components/resolve/discover/discover-need-type-filters";
import { DiscoverRoleFilters } from "@/components/resolve/discover/discover-role-filters";
import type { DiscoverNeedTypeFilter } from "@/lib/discover/need-types";
import type { DiscoverRole } from "@/lib/discover/role-filters";

const DOMAIN_CHIPS = [
  { label: "Music", id: "radar-music" },
  { label: "Video", id: "radar-media" },
  { label: "OSS", id: "radar-oss" },
  { label: "Writers", id: "radar-education" },
  { label: "Research", id: "radar-dao" },
  { label: "DAO", id: "radar-dao" },
  { label: "Communities", id: "communities" },
] as const;

export function DiscoverRefinePanel({
  role,
  onRoleChange,
  needType,
  onNeedTypeChange,
  onDomainJump,
  className,
}: {
  role: DiscoverRole;
  onRoleChange: (role: DiscoverRole) => void;
  needType: DiscoverNeedTypeFilter;
  onNeedTypeChange: (needType: DiscoverNeedTypeFilter) => void;
  onDomainJump: (anchorId: string) => void;
  className?: string;
}) {
  return (
    <details
      className={clsx(
        "discover-refine-panel group scroll-mt-24 overflow-hidden rounded-2xl border border-resolve-border/60 bg-resolve-surface/40 backdrop-blur-md",
        className,
      )}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:content-none [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-resolve-border/50 bg-white/[0.04]">
            <SlidersHorizontal className="h-3.5 w-3.5 text-resolve-accent" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white">Refine your view</p>
            <p className="text-[10px] text-resolve-muted">
              Role, need type, and domain — optional after you pick a job
            </p>
          </div>
        </div>
        <span className="discover-refine-chevron shrink-0 text-[10px] font-medium uppercase tracking-wider text-resolve-muted">
          Expand
        </span>
      </summary>

      <div className="space-y-5 border-t border-resolve-border/40 px-4 py-4">
        <DiscoverRoleFilters value={role} onChange={onRoleChange} />
        <DiscoverNeedTypeFilters value={needType} onChange={onNeedTypeChange} />

        <div className="space-y-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-muted">
            Jump to domain
          </span>
          <div className="flex flex-wrap gap-2">
            {DOMAIN_CHIPS.map((d) => (
              <button
                key={`${d.label}-${d.id}`}
                type="button"
                onClick={() => onDomainJump(d.id)}
                className="discover-chip rounded-full border px-3 py-1 text-[11px] font-medium transition"
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </details>
  );
}
