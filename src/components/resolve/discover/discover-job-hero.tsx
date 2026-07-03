"use client";

import clsx from "clsx";
import { DISCOVER_JOBS, type DiscoverJobId } from "@/lib/discover/discover-jobs";
import { DISCOVER_HERO_SUBTITLE, DISCOVER_HERO_TITLE } from "@/lib/discover/discover-lane-copy";
import type { DiscoverRole } from "@/lib/discover/role-filters";

export function DiscoverJobHero({
  activeJob,
  onSelectJob,
  className,
}: {
  activeJob?: DiscoverJobId | null;
  onSelectJob: (jobId: DiscoverJobId, role: DiscoverRole, scrollTo: string) => void;
  className?: string;
}) {
  return (
    <header className={clsx("discover-on-canvas relative mb-4", className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="discover-eyebrow text-[10px] font-semibold uppercase tracking-[0.24em]">
            Discover
          </p>
          <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-white sm:text-xl">
            {DISCOVER_HERO_TITLE}
          </h1>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-resolve-muted">
            {DISCOVER_HERO_SUBTITLE}
          </p>
        </div>
      </div>

      <div
        className="relative mt-3 flex flex-wrap gap-1.5"
        role="tablist"
        aria-label="Discover intent"
      >
        {DISCOVER_JOBS.map((job) => {
          const selected = activeJob === job.id;
          return (
            <button
              key={job.id}
              type="button"
              role="tab"
              aria-selected={selected}
              title={job.title}
              onClick={() => onSelectJob(job.id, job.role, job.scrollTo)}
              className={clsx(
                "rounded-full border px-3 py-1.5 text-[11px] font-medium transition",
                selected
                  ? "border-white/20 bg-white text-black shadow-sm"
                  : "border-white/10 bg-white/[0.03] text-resolve-muted hover:border-white/20 hover:text-white",
              )}
            >
              {job.who}
            </button>
          );
        })}
      </div>
    </header>
  );
}
