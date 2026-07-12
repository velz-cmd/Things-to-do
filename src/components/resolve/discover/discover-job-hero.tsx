"use client";

import Image from "next/image";
import clsx from "clsx";
import { ArrowRight, CircleDollarSign, Database, FileCheck2 } from "lucide-react";
import { BRAND_LOGO_PATH } from "@/lib/brand/assets";
import { DISCOVER_JOBS, type DiscoverJobId } from "@/lib/discover/discover-jobs";
import { DISCOVER_HERO_SUBTITLE, DISCOVER_HERO_TITLE } from "@/lib/discover/discover-lane-copy";
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
      <div className={styles.headerTopline}>
        <p className={styles.eyebrow}>Discover OS</p>
        <div className={styles.headerStatus}>
          <span className={styles.headerStatusDot} aria-hidden="true" />
          <span>Operating desk</span>
          <span aria-hidden="true">·</span>
          <span>Arc testnet</span>
        </div>
      </div>

      <div className={styles.headlineGrid}>
        <div>
          <h1 className={styles.title}>{DISCOVER_HERO_TITLE}</h1>
          <p className={styles.description}>
            {DISCOVER_HERO_SUBTITLE.split(". Act in one click:")[0]}.
          </p>
        </div>

        <div className={styles.routeIndicator} aria-label="RESOLVE value route architecture preview">
          <span className={styles.routeNode}>
            <Database className="h-4 w-4" />
            Sources
          </span>
          <span className={styles.routeLine} aria-hidden="true" />
          <span className={styles.routeNode}>
            <Image src={BRAND_LOGO_PATH} alt="RESOLVE" width={28} height={28} className={styles.routeLogo} />
            Evidence
          </span>
          <span className={styles.routeLine} aria-hidden="true" />
          <span className={styles.routeNode}>
            <FileCheck2 className="h-4 w-4" />
            Program
          </span>
          <span className={styles.routeLine} aria-hidden="true" />
          <span className={styles.routeNode}>
            <CircleDollarSign className="h-4 w-4" />
            Arc
          </span>
        </div>
      </div>

      <div className={styles.searchWrap}>
        <DiscoverGlobalSearch
          signedIn={signedIn}
          query={query}
          onQueryChange={onQueryChange}
          className={styles.searchShell}
        />
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
              <span className={styles.quickIcon}><Icon className="h-4 w-4" strokeWidth={1.8} /></span>
              <span className={styles.quickCopy}>
                <span className={styles.quickTitle}>{job.who}</span>
                <span className={styles.quickDescription}>{job.surfaces}</span>
              </span>
              <ArrowRight className={styles.quickArrow} />
            </button>
          );
        })}
      </div>
    </header>
  );
}
