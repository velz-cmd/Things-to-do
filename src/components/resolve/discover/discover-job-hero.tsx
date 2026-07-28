"use client";

import clsx from "clsx";
import { DISCOVER_JOBS, type DiscoverJobId } from "@/lib/discover/discover-jobs";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import { DiscoverGlobalSearch } from "@/components/resolve/discover/discover-global-search";
import styles from "./discover-workspace.module.css";

export function DiscoverJobHero({
  activeJob,
  onSelectJob,
  className,
  signedIn,
  query,
  onQueryChange,
}: {
  activeJob?: DiscoverJobId | null;
  onSelectJob: (jobId: DiscoverJobId, role: DiscoverRole, scrollTo: string) => void;
  className?: string;
  signedIn: boolean;
  query: string;
  onQueryChange: (query: string) => void;
}) {
  return (
    <header className={clsx(styles.commandHeader, className)}>
      <div className={styles.compactIntro}>
        <div className={styles.introCopy}>
          <p className={styles.eyebrow}>RESOLVE Funding Coverage Monitor</p>
          <h1 className={styles.title}>Discover</h1>
          <p className={styles.description}>
            See which accepted work your funding rules cover, what they miss, and what is blocking the next payout.
          </p>
        </div>

        <div className={styles.searchWrap}>
          <div className={styles.headerStatus}>
            <span className={styles.headerStatusDot} aria-hidden="true" />
            <span>Funding coverage</span>
          </div>
          <DiscoverGlobalSearch
            signedIn={signedIn}
            query={query}
            onQueryChange={onQueryChange}
            className={styles.searchShell}
          />
        </div>
      </div>

      <div className={styles.quickRail} role="tablist" aria-label="Discover quick actions">
        {DISCOVER_JOBS.map((job) => {
          const selected = activeJob === job.id;
          const Icon = job.icon;
          return (
            <button
              key={job.id}
              type="button"
              role="tab"
              aria-selected={selected}
              title={`${job.title}. ${job.surfaces}`}
              onClick={() => onSelectJob(job.id, job.role, job.scrollTo)}
              className={clsx(styles.quickAction, selected && styles.quickActionActive)}
            >
              <span className={styles.quickIcon}><Icon className="h-3.5 w-3.5" strokeWidth={1.8} /></span>
              <span className={styles.quickTitle}>{job.who}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
}
