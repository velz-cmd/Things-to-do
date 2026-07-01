"use client";

import clsx from "clsx";
import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { DiscoverNeedTypeFilters } from "@/components/resolve/discover/discover-need-type-filters";
import { DiscoverRoleFilters } from "@/components/resolve/discover/discover-role-filters";
import type { DiscoverNeedTypeFilter } from "@/lib/discover/need-types";
import type { DiscoverRole } from "@/lib/discover/role-filters";

const DOMAIN_CHIPS = [
  { label: "Music", id: "radar-music" },
  { label: "OSS", id: "radar-oss" },
  { label: "DAO", id: "radar-dao" },
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
        "discover-refine-panel group scroll-mt-24 overflow-hidden rounded-xl border border-resolve-border/40 bg-black/15",
        className,
      )}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 marker:content-none [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-resolve-muted" strokeWidth={1.75} />
          <span className="text-[11px] text-resolve-muted">
            Refine role & filters
            {role !== "all" && (
              <span className="ml-1.5 text-resolve-accent">· {role}</span>
            )}
          </span>
        </div>
        <span className="discover-refine-chevron shrink-0 text-[9px] uppercase tracking-wider text-resolve-muted-dim">
          More
        </span>
      </summary>

      <div className="space-y-4 border-t border-resolve-border/30 px-3 py-3">
        <DiscoverRoleFilters value={role} onChange={onRoleChange} />
        <DiscoverNeedTypeFilters value={needType} onChange={onNeedTypeChange} />

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
            Domain
          </span>
          {DOMAIN_CHIPS.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => onDomainJump(d.id)}
              className="discover-chip rounded-full border px-2.5 py-0.5 text-[10px] font-medium transition"
            >
              {d.label}
            </button>
          ))}
          <Link
            href="/communities"
            className="discover-chip rounded-full border px-2.5 py-0.5 text-[10px] font-medium transition"
          >
            Communities →
          </Link>
        </div>
      </div>
    </details>
  );
}
