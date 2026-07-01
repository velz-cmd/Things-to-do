"use client";

import clsx from "clsx";
import { DISCOVER_JOBS, type DiscoverJobId } from "@/lib/discover/discover-jobs";
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
    <header className={clsx("discover-on-canvas relative mb-5", className)}>
      <div className="relative flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="discover-eyebrow text-[10px] font-semibold uppercase tracking-[0.24em]">
            Discover
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-white sm:text-2xl">
            What do you want to do?
          </h1>
        </div>
        <p className="discover-subtitle max-w-md text-[11px] leading-snug sm:text-xs">
          Pick a job — proof, actions, and rails surface below. No essays.
        </p>
      </div>

      <ul className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {DISCOVER_JOBS.map((job) => {
          const Icon = job.icon;
          const selected = activeJob === job.id;
          return (
            <li key={job.id}>
              <button
                type="button"
                title={`${job.surfaces}`}
                onClick={() => onSelectJob(job.id, job.role, job.scrollTo)}
                className={clsx(
                  "discover-job-pill group flex w-full flex-col items-start gap-1 rounded-xl border px-2.5 py-2 text-left transition",
                  `discover-job-pill--${job.id}`,
                  selected && "discover-job-pill--selected",
                )}
              >
                <div className="flex w-full items-center gap-2">
                  <span className="discover-job-pill__icon flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05]">
                    <Icon className="h-3.5 w-3.5 text-white/85" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1 text-[11px] font-semibold leading-tight text-white sm:text-xs">
                    {job.title}
                  </span>
                </div>
                <span className="pl-9 text-[9px] font-medium uppercase tracking-wide text-resolve-calm-periwinkle/90">
                  {job.who}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </header>
  );
}
